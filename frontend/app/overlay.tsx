import React, { useState, useEffect } from 'react';
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
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useOverlayStore } from '../store/overlayStore';
import { localComparison, generateOverlayPDF } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [imageLayout, setImageLayout] = useState({ width: 300, height: 400 });

  // Animated values for overlay transform
  const translateX = useSharedValue(50);
  const translateY = useSharedValue(50);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const alpha = useSharedValue(0.7);

  // Saved values for gesture start
  const savedTranslateX = useSharedValue(50);
  const savedTranslateY = useSharedValue(50);
  const savedScale = useSharedValue(1);
  const savedRotation = useSharedValue(0);

  // Update store periodically
  const updateStore = () => {
    setOverlayPosition(translateX.value, translateY.value);
    setOverlayScale(scale.value);
    setOverlayRotation(rotation.value);
  };

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(updateStore)();
      runOnJS(runLocalComparison)();
    });

  // Pinch gesture for scaling
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.25, Math.min(3, savedScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(updateStore)();
      runOnJS(runLocalComparison)();
    });

  // Rotation gesture
  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = savedRotation.value + (e.rotation * 180 / Math.PI);
    })
    .onEnd(() => {
      runOnJS(updateStore)();
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);

  // Animated style for overlay
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
      
      setLocalComparison(
        result.local_ssim,
        result.edge_overlap,
        result.difference_heatmap,
        result.edge_visualization
      );
    } catch (error) {
      console.error('Local comparison error:', error);
    } finally {
      setIsComparing(false);
    }
  };

  // Run initial comparison
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
    setOverlayScale(value);
  };

  const handleRotationSlider = (value: number) => {
    rotation.value = value;
    setOverlayRotation(value);
  };

  const rotateBy = (degrees: number) => {
    rotation.value = rotation.value + degrees;
    setOverlayRotation(rotation.value);
  };

  const handleReset = () => {
    translateX.value = 50;
    translateY.value = 50;
    scale.value = 1;
    rotation.value = 0;
    alpha.value = 0.7;
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
      await FileSystem.writeAsStringAsync(fileUri, result.pdf_base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      } else if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${result.pdf_base64}`;
        link.download = result.filename;
        link.click();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleBack = () => {
    resetAll();
    router.replace('/');
  };

  const handleRemove = () => {
    Alert.alert('Remove Overlay', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { resetOverlay(); router.back(); } },
    ]);
  };

  const getScoreColor = (score: number) => score >= 50 ? '#22c55e' : '#ef4444';

  if (!baseImage || !croppedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="layers-outline" size={64} color="#64748b" />
          <Text style={styles.emptyText}>No overlay data</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
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
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Overlay Adjustment</Text>
          <View style={styles.headerRight}>
            {isComparing && <ActivityIndicator size="small" color="#3b82f6" />}
          </View>
        </View>

        {/* Gesture Hint */}
        <View style={styles.gestureHint}>
          <Text style={styles.gestureHintText}>
            Drag to move • Pinch to zoom • Two fingers to rotate
          </Text>
        </View>

        {/* Image Area */}
        <View style={styles.imageArea} onLayout={(e) => setImageLayout(e.nativeEvent.layout)}>
          {/* Base Image */}
          <Image source={{ uri: baseImage }} style={styles.baseImage} resizeMode="contain" />

          {/* Grid */}
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

          {/* Crosshair */}
          {showCrosshair && (
            <View style={styles.crosshairContainer}>
              <View style={[styles.crosshairLine, { width: 1, height: '100%' }]} />
              <View style={[styles.crosshairLine, { height: 1, width: '100%' }]} />
            </View>
          )}

          {/* Draggable Overlay */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View
              style={[
                styles.overlayWrapper,
                { width: croppedWidth, height: croppedHeight },
                overlayAnimatedStyle,
              ]}
            >
              <Image source={{ uri: croppedImage }} style={styles.overlayImage} resizeMode="stretch" />
              <View style={styles.overlayBorder} />
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Control Panel */}
        <ScrollView style={styles.controlPanel} contentContainerStyle={styles.controlContent}>
          {/* Scores */}
          <View style={styles.scoresRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Local SSIM</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(localSSIM) }]}>
                {localSSIM.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Edge Match</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(edgeOverlap) }]}>
                {edgeOverlap.toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Rotation Controls */}
          <View style={styles.controlSection}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlLabel}>Rotation</Text>
              <Text style={styles.controlValue}>{rotation.value.toFixed(1)}°</Text>
            </View>
            <View style={styles.rotationButtons}>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(-15)}>
                <Text style={styles.rotBtnText}>-15°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(-5)}>
                <Text style={styles.rotBtnText}>-5°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(-1)}>
                <Text style={styles.rotBtnText}>-1°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rotBtn, styles.rotBtnReset]} onPress={() => { rotation.value = 0; setOverlayRotation(0); }}>
                <Text style={styles.rotBtnText}>0°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(1)}>
                <Text style={styles.rotBtnText}>+1°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(5)}>
                <Text style={styles.rotBtnText}>+5°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rotBtn} onPress={() => rotateBy(15)}>
                <Text style={styles.rotBtnText}>+15°</Text>
              </TouchableOpacity>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={-180}
              maximumValue={180}
              value={rotation.value}
              onValueChange={handleRotationSlider}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3b82f6"
            />
          </View>

          {/* Scale */}
          <View style={styles.controlSection}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlLabel}>Scale (Pinch to zoom)</Text>
              <Text style={styles.controlValue}>{Math.round(scale.value * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.25}
              maximumValue={3}
              value={scale.value}
              onValueChange={handleScaleSlider}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3b82f6"
            />
          </View>

          {/* Transparency */}
          <View style={styles.controlSection}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlLabel}>Transparency</Text>
              <Text style={styles.controlValue}>{Math.round(alpha.value * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.1}
              maximumValue={1}
              value={alpha.value}
              onValueChange={handleAlphaChange}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3b82f6"
            />
          </View>

          {/* Toggles */}
          <View style={styles.togglesRow}>
            <TouchableOpacity style={[styles.toggleBtn, showGrid && styles.toggleActive]} onPress={toggleGrid}>
              <Ionicons name="grid-outline" size={18} color={showGrid ? '#fff' : '#94a3b8'} />
              <Text style={[styles.toggleText, showGrid && styles.toggleTextActive]}>Grid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, showCrosshair && styles.toggleActive]} onPress={toggleCrosshair}>
              <Ionicons name="locate-outline" size={18} color={showCrosshair ? '#fff' : '#94a3b8'} />
              <Text style={[styles.toggleText, showCrosshair && styles.toggleTextActive]}>Center</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, showHeatmap && styles.toggleActive]} onPress={toggleHeatmap}>
              <Ionicons name="flame-outline" size={18} color={showHeatmap ? '#fff' : '#94a3b8'} />
              <Text style={[styles.toggleText, showHeatmap && styles.toggleTextActive]}>Heatmap</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={18} color="#f8fafc" />
              <Text style={styles.actionBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleRemove}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, generatingPDF && styles.disabledBtn]}
            onPress={handleSaveReport}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  headerRight: { width: 40, alignItems: 'center' },
  gestureHint: { backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 16 },
  gestureHintText: { fontSize: 12, color: '#3b82f6', textAlign: 'center', fontWeight: '500' },
  imageArea: { flex: 1, position: 'relative', backgroundColor: '#000' },
  baseImage: { width: '100%', height: '100%' },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(59, 130, 246, 0.3)' },
  crosshairContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  crosshairLine: { position: 'absolute', backgroundColor: 'rgba(59, 130, 246, 0.5)' },
  overlayWrapper: { position: 'absolute' },
  overlayImage: { width: '100%', height: '100%' },
  overlayBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: '#3b82f6', borderStyle: 'dashed' },
  controlPanel: { maxHeight: SCREEN_HEIGHT * 0.4, backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  controlContent: { padding: 16, paddingBottom: 32 },
  scoresRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  scoreCard: { flex: 1, backgroundColor: '#0f172a', borderRadius: 12, padding: 12, alignItems: 'center' },
  scoreLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  scoreValue: { fontSize: 24, fontWeight: 'bold' },
  controlSection: { marginBottom: 12 },
  controlHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  controlLabel: { fontSize: 14, color: '#f8fafc' },
  controlValue: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  slider: { width: '100%', height: 40 },
  rotationButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 4 },
  rotBtn: { flex: 1, paddingVertical: 8, backgroundColor: '#334155', borderRadius: 6, alignItems: 'center' },
  rotBtnReset: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#3b82f6' },
  rotBtnText: { fontSize: 11, color: '#f8fafc', fontWeight: '500' },
  togglesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0f172a' },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleText: { fontSize: 12, color: '#94a3b8' },
  toggleTextActive: { color: '#fff' },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, backgroundColor: '#334155' },
  dangerBtn: { backgroundColor: '#dc2626' },
  actionBtnText: { fontSize: 14, color: '#f8fafc', fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#059669' },
  saveBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  disabledBtn: { opacity: 0.6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, color: '#64748b', marginTop: 16 },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
