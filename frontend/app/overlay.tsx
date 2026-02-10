import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  runOnJS,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useOverlayStore } from '../store/overlayStore';
import { localComparison, generateOverlayPDF } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Forensic Lab Colors
const COLORS = {
  bgDark: '#0a0e14',
  bgPanel: '#111922',
  bgCard: '#1a2332',
  accent: '#00d4ff',
  accentDim: '#0891b2',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  text: '#e2e8f0',
  textDim: '#64748b',
  border: '#1e3a5f',
  glow: 'rgba(0, 212, 255, 0.15)',
};

export default function OverlayAdjustmentScreen() {
  const router = useRouter();
  const {
    baseImage,
    croppedImage,
    croppedWidth,
    croppedHeight,
    overlayAlpha,
    showGrid,
    showCrosshair,
    showHeatmap,
    localSSIM,
    edgeOverlap,
    differenceHeatmap,
    isComparing,
    setOverlayPosition,
    setOverlayScale,
    setOverlayRotation,
    setOverlayAlpha,
    toggleGrid,
    toggleCrosshair,
    toggleHeatmap,
    setLocalComparison,
    setIsComparing,
    resetOverlay,
    resetAll,
  } = useOverlayStore();

  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [displayScale, setDisplayScale] = useState(100);
  const [displayRotation, setDisplayRotation] = useState(0);

  // Animated values with better control
  const translateX = useSharedValue(50);
  const translateY = useSharedValue(50);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const alpha = useSharedValue(0.7);

  // Context values for gesture tracking
  const savedTranslateX = useSharedValue(50);
  const savedTranslateY = useSharedValue(50);
  const savedScale = useSharedValue(1);
  const savedRotation = useSharedValue(0);

  const updateDisplayValues = useCallback(() => {
    setDisplayScale(Math.round(scale.value * 100));
    setDisplayRotation(Math.round(rotation.value));
  }, []);

  const updateStore = useCallback(() => {
    setOverlayPosition(translateX.value, translateY.value);
    setOverlayScale(scale.value);
    setOverlayRotation(rotation.value);
    updateDisplayValues();
  }, []);

  // Smoother pan gesture with worklet annotation
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(updateStore)();
    });

  // Fixed pinch gesture with stronger damping and proper tracking
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Apply stronger damping to make zoom less sensitive
      // e.scale is relative to start (1.0 = no change)
      const dampingFactor = 0.4; // Reduce sensitivity by 60%
      const scaleDelta = e.scale - 1; // How much change from initial
      const dampedDelta = scaleDelta * dampingFactor;
      const newScale = savedScale.value * (1 + dampedDelta);
      
      // Clamp between 0.3 and 2.5 for smoother feel
      scale.value = Math.max(0.3, Math.min(2.5, newScale));
      runOnJS(updateDisplayValues)();
    })
    .onEnd(() => {
      'worklet';
      // Snap to nearest 10% if close for cleaner values
      const rounded = Math.round(scale.value * 10) / 10;
      if (Math.abs(scale.value - rounded) < 0.05) {
        scale.value = withSpring(rounded, { damping: 20, stiffness: 200 });
      }
      runOnJS(updateStore)();
      runOnJS(runLocalComparison)();
    });

  // Smoother rotation gesture with worklet annotation
  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      'worklet';
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Apply damping to rotation
      const dampingFactor = 0.6;
      const rotationDelta = (e.rotation * 180 / Math.PI) * dampingFactor;
      rotation.value = savedRotation.value + rotationDelta;
      runOnJS(updateDisplayValues)();
    })
    .onEnd(() => {
      'worklet';
      // Snap to nearest 5 degrees if close
      const snapped = Math.round(rotation.value / 5) * 5;
      if (Math.abs(rotation.value - snapped) < 3) {
        rotation.value = withSpring(snapped, { damping: 15, stiffness: 150 });
      }
      runOnJS(updateStore)();
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: alpha.value,
  }));

  const runLocalComparison = async () => {
    if (!baseImage || !croppedImage) return;
    setIsComparing(true);
    try {
      const result = await localComparison({
        base_image: baseImage,
        overlay_image: croppedImage,
        overlay_x: Math.round(translateX.value),
        overlay_y: Math.round(translateY.value),
        overlay_width: Math.round(croppedWidth * scale.value),
        overlay_height: Math.round(croppedHeight * scale.value),
      });
      setLocalComparison(result.local_ssim, result.edge_overlap, result.difference_heatmap, result.edge_visualization);
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setIsComparing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(runLocalComparison, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAlphaChange = (value: number) => {
    alpha.value = value;
    setOverlayAlpha(value);
  };

  const handleScaleSlider = (value: number) => {
    scale.value = value;
    setDisplayScale(Math.round(value * 100));
    setOverlayScale(value);
  };

  const handleRotationSlider = (value: number) => {
    rotation.value = value;
    setDisplayRotation(Math.round(value));
    setOverlayRotation(value);
  };

  const rotateBy = (degrees: number) => {
    const newRotation = rotation.value + degrees;
    rotation.value = withSpring(newRotation, { damping: 15, stiffness: 150 });
    setDisplayRotation(Math.round(newRotation));
    setOverlayRotation(newRotation);
  };

  const handleReset = () => {
    translateX.value = withSpring(50);
    translateY.value = withSpring(50);
    scale.value = withSpring(1);
    rotation.value = withSpring(0);
    alpha.value = 0.7;
    setDisplayScale(100);
    setDisplayRotation(0);
    setOverlayPosition(50, 50);
    setOverlayScale(1);
    setOverlayRotation(0);
    setOverlayAlpha(0.7);
  };

  const handleSaveReport = async () => {
    if (!baseImage || !croppedImage) return;
    setGeneratingPDF(true);
    try {
      const result = await generateOverlayPDF({
        base_image: baseImage,
        overlay_image: croppedImage,
        overlay_x: Math.round(translateX.value),
        overlay_y: Math.round(translateY.value),
        overlay_width: Math.round(croppedWidth * scale.value),
        overlay_height: Math.round(croppedHeight * scale.value),
        overlay_alpha: alpha.value,
        local_ssim: localSSIM,
        edge_overlap: edgeOverlap,
      });
      const fileUri = `${FileSystem.documentDirectory}${result.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, result.pdf_base64, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleBack = () => { resetAll(); router.replace('/'); };
  const handleRemove = () => {
    Alert.alert('Remove Overlay', 'Discard current analysis?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { resetOverlay(); router.back(); } },
    ]);
  };

  const getScoreColor = (score: number) => score >= 50 ? COLORS.success : COLORS.danger;

  if (!baseImage || !croppedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="layers-outline" size={64} color={COLORS.textDim} />
          <Text style={styles.emptyText}>No specimen data</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Return</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerLabel}>SPECIMEN ANALYSIS</Text>
            <Text style={styles.headerTitle}>Overlay Comparator</Text>
          </View>
          <View style={styles.statusIndicator}>
            {isComparing ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
            )}
          </View>
        </View>

        {/* Gesture Hint */}
        <View style={styles.gestureHint}>
          <View style={styles.hintItem}>
            <Ionicons name="move" size={14} color={COLORS.accent} />
            <Text style={styles.hintText}>Drag</Text>
          </View>
          <View style={styles.hintDivider} />
          <View style={styles.hintItem}>
            <Ionicons name="resize" size={14} color={COLORS.accent} />
            <Text style={styles.hintText}>Pinch</Text>
          </View>
          <View style={styles.hintDivider} />
          <View style={styles.hintItem}>
            <Ionicons name="sync" size={14} color={COLORS.accent} />
            <Text style={styles.hintText}>Rotate</Text>
          </View>
        </View>

        {/* Analysis Area */}
        <View style={styles.analysisArea}>
          <View style={styles.scanlineOverlay} />
          <Image source={{ uri: baseImage }} style={styles.baseImage} resizeMode="contain" />

          {showGrid && (
            <View style={styles.gridOverlay}>
              {[...Array(9)].map((_, i) => (
                <View key={`v${i}`} style={[styles.gridLine, { left: `${(i + 1) * 10}%`, top: 0, bottom: 0, width: 1 }]} />
              ))}
              {[...Array(9)].map((_, i) => (
                <View key={`h${i}`} style={[styles.gridLine, { top: `${(i + 1) * 10}%`, left: 0, right: 0, height: 1 }]} />
              ))}
            </View>
          )}

          {showCrosshair && (
            <View style={styles.crosshairContainer}>
              <View style={[styles.crosshairLine, styles.crosshairV]} />
              <View style={[styles.crosshairLine, styles.crosshairH]} />
              <View style={styles.crosshairCenter} />
            </View>
          )}

          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.overlayWrapper, { width: croppedWidth, height: croppedHeight }, overlayAnimatedStyle]}>
              <Image source={{ uri: croppedImage }} style={styles.overlayImage} resizeMode="stretch" />
              <View style={styles.overlayBorder} />
              <View style={styles.overlayCornerTL} />
              <View style={styles.overlayCornerTR} />
              <View style={styles.overlayCornerBL} />
              <View style={styles.overlayCornerBR} />
            </Animated.View>
          </GestureDetector>

          {/* Live Stats Overlay */}
          <View style={styles.liveStats}>
            <Text style={styles.liveStatText}>SCALE: {displayScale}%</Text>
            <Text style={styles.liveStatText}>ROT: {displayRotation}°</Text>
          </View>
        </View>

        {/* Control Panel */}
        <ScrollView style={styles.controlPanel} contentContainerStyle={styles.controlContent}>
          {/* Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>STRUCTURAL MATCH</Text>
              <Text style={[styles.metricValue, { color: getScoreColor(localSSIM) }]}>{localSSIM.toFixed(1)}%</Text>
              <View style={[styles.metricBar, { backgroundColor: getScoreColor(localSSIM) + '30' }]}>
                <View style={[styles.metricBarFill, { width: `${localSSIM}%`, backgroundColor: getScoreColor(localSSIM) }]} />
              </View>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>EDGE CORRELATION</Text>
              <Text style={[styles.metricValue, { color: getScoreColor(edgeOverlap) }]}>{edgeOverlap.toFixed(1)}%</Text>
              <View style={[styles.metricBar, { backgroundColor: getScoreColor(edgeOverlap) + '30' }]}>
                <View style={[styles.metricBarFill, { width: `${edgeOverlap}%`, backgroundColor: getScoreColor(edgeOverlap) }]} />
              </View>
            </View>
          </View>

          {/* Rotation Control */}
          <View style={styles.controlGroup}>
            <View style={styles.controlHeader}>
              <Ionicons name="sync-outline" size={16} color={COLORS.accent} />
              <Text style={styles.controlLabel}>ROTATION</Text>
              <Text style={styles.controlValueBadge}>{displayRotation}°</Text>
            </View>
            <View style={styles.rotationBtns}>
              {[-15, -5, -1, 0, 1, 5, 15].map((deg) => (
                <TouchableOpacity
                  key={deg}
                  style={[styles.rotBtn, deg === 0 && styles.rotBtnReset]}
                  onPress={() => deg === 0 ? handleRotationSlider(0) : rotateBy(deg)}
                >
                  <Text style={styles.rotBtnText}>{deg === 0 ? 'RESET' : `${deg > 0 ? '+' : ''}${deg}°`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Slider
              style={styles.slider}
              minimumValue={-180}
              maximumValue={180}
              value={rotation.value}
              onValueChange={handleRotationSlider}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.accent}
            />
          </View>

          {/* Scale Control */}
          <View style={styles.controlGroup}>
            <View style={styles.controlHeader}>
              <Ionicons name="resize-outline" size={16} color={COLORS.accent} />
              <Text style={styles.controlLabel}>MAGNIFICATION</Text>
              <Text style={styles.controlValueBadge}>{displayScale}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.3}
              maximumValue={2.5}
              value={scale.value}
              onValueChange={handleScaleSlider}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.accent}
            />
          </View>

          {/* Opacity Control */}
          <View style={styles.controlGroup}>
            <View style={styles.controlHeader}>
              <Ionicons name="eye-outline" size={16} color={COLORS.accent} />
              <Text style={styles.controlLabel}>OPACITY</Text>
              <Text style={styles.controlValueBadge}>{Math.round(alpha.value * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.1}
              maximumValue={1}
              value={alpha.value}
              onValueChange={handleAlphaChange}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.accent}
            />
          </View>

          {/* View Toggles */}
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, showGrid && styles.toggleActive]} onPress={toggleGrid}>
              <Ionicons name="grid-outline" size={18} color={showGrid ? COLORS.bgDark : COLORS.accent} />
              <Text style={[styles.toggleText, showGrid && styles.toggleTextActive]}>GRID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, showCrosshair && styles.toggleActive]} onPress={toggleCrosshair}>
              <Ionicons name="locate-outline" size={18} color={showCrosshair ? COLORS.bgDark : COLORS.accent} />
              <Text style={[styles.toggleText, showCrosshair && styles.toggleTextActive]}>RETICLE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, showHeatmap && styles.toggleActive]} onPress={toggleHeatmap}>
              <Ionicons name="thermometer-outline" size={18} color={showHeatmap ? COLORS.bgDark : COLORS.accent} />
              <Text style={[styles.toggleText, showHeatmap && styles.toggleTextActive]}>THERMAL</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={18} color={COLORS.accent} />
              <Text style={styles.actionBtnText}>RESET</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleRemove}>
              <Ionicons name="close-circle" size={18} color={COLORS.danger} />
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>DISCARD</Text>
            </TouchableOpacity>
          </View>

          {/* Export Button */}
          <TouchableOpacity
            style={[styles.exportBtn, generatingPDF && styles.disabledBtn]}
            onPress={handleSaveReport}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <ActivityIndicator size="small" color={COLORS.bgDark} />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color={COLORS.bgDark} />
                <Text style={styles.exportBtnText}>EXPORT ANALYSIS REPORT</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { padding: 8 },
  headerTitleContainer: { alignItems: 'center' },
  headerLabel: { fontSize: 10, color: COLORS.accent, letterSpacing: 2 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  statusIndicator: { width: 40, alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  gestureHint: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: COLORS.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintText: { fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  hintDivider: { width: 1, height: 12, backgroundColor: COLORS.border, marginHorizontal: 16 },
  analysisArea: { 
    flex: 1, 
    position: 'relative', 
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: COLORS.border,
    margin: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.03,
  },
  baseImage: { width: '100%', height: '100%' },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: COLORS.accent + '20' },
  crosshairContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  crosshairLine: { position: 'absolute', backgroundColor: COLORS.accent + '60' },
  crosshairV: { width: 1, height: '100%' },
  crosshairH: { height: 1, width: '100%' },
  crosshairCenter: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  overlayWrapper: { position: 'absolute' },
  overlayImage: { width: '100%', height: '100%' },
  overlayBorder: { 
    ...StyleSheet.absoluteFillObject, 
    borderWidth: 2, 
    borderColor: COLORS.accent,
    borderStyle: 'solid',
  },
  overlayCornerTL: { position: 'absolute', top: -2, left: -2, width: 12, height: 12, borderTopWidth: 3, borderLeftWidth: 3, borderColor: COLORS.accent },
  overlayCornerTR: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderTopWidth: 3, borderRightWidth: 3, borderColor: COLORS.accent },
  overlayCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 12, height: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: COLORS.accent },
  overlayCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderBottomWidth: 3, borderRightWidth: 3, borderColor: COLORS.accent },
  liveStats: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.bgDark + 'DD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  liveStatText: { fontSize: 10, color: COLORS.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  controlPanel: { 
    maxHeight: SCREEN_HEIGHT * 0.42, 
    backgroundColor: COLORS.bgPanel,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  controlContent: { padding: 16, paddingBottom: 32 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricCard: { 
    flex: 1, 
    backgroundColor: COLORS.bgCard, 
    borderRadius: 8, 
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: { fontSize: 9, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  metricBar: { height: 4, borderRadius: 2, marginTop: 8 },
  metricBarFill: { height: '100%', borderRadius: 2 },
  controlGroup: { marginBottom: 16 },
  controlHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  controlLabel: { flex: 1, fontSize: 11, color: COLORS.text, letterSpacing: 1 },
  controlValueBadge: { 
    fontSize: 12, 
    color: COLORS.accent, 
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slider: { width: '100%', height: 40 },
  rotationBtns: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  rotBtn: { 
    flex: 1, 
    paddingVertical: 8, 
    backgroundColor: COLORS.bgCard, 
    borderRadius: 4, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rotBtnReset: { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent },
  rotBtnText: { fontSize: 9, color: COLORS.text, fontWeight: '600', letterSpacing: 0.5 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 12, 
    borderRadius: 6, 
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  toggleText: { fontSize: 10, color: COLORS.accent, letterSpacing: 1 },
  toggleTextActive: { color: COLORS.bgDark },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 12, 
    borderRadius: 6, 
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dangerBtn: { borderColor: COLORS.danger + '50' },
  actionBtnText: { fontSize: 11, color: COLORS.accent, fontWeight: '600', letterSpacing: 1 },
  exportBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    paddingVertical: 16, 
    borderRadius: 8, 
    backgroundColor: COLORS.accent,
  },
  exportBtnText: { fontSize: 13, color: COLORS.bgDark, fontWeight: '700', letterSpacing: 1 },
  disabledBtn: { opacity: 0.6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: COLORS.textDim, marginTop: 16, letterSpacing: 1 },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.accent, borderRadius: 8 },
  backButtonText: { color: COLORS.bgDark, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
});
