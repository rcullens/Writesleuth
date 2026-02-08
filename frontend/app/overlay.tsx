import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
    overlayX,
    overlayY,
    overlayScale,
    overlayRotation,
    overlayAlpha,
    showGrid,
    showCrosshair,
    showHeatmap,
    localSSIM,
    edgeOverlap,
    differenceHeatmap,
    edgeVisualization,
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

  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  // Gesture state refs
  const gestureState = useRef({
    startX: overlayX,
    startY: overlayY,
    startScale: overlayScale,
    startRotation: overlayRotation,
    initialDistance: 0,
    initialAngle: 0,
    isMultiTouch: false,
  });

  // Calculate distance between two touch points
  const getDistance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate angle between two touch points
  const getAngle = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[1].pageX - touches[0].pageX;
    const dy = touches[1].pageY - touches[0].pageY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  // Pan responder for drag, pinch-to-zoom, and rotate
  const overlayPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        gestureState.current = {
          startX: overlayX,
          startY: overlayY,
          startScale: overlayScale,
          startRotation: overlayRotation,
          initialDistance: getDistance(touches),
          initialAngle: getAngle(touches),
          isMultiTouch: touches.length >= 2,
        };
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        
        if (touches.length >= 2) {
          // Multi-touch: pinch to zoom and rotate
          const currentDistance = getDistance(touches);
          const currentAngle = getAngle(touches);
          
          if (gestureState.current.initialDistance > 0) {
            // Calculate scale change
            const scaleChange = currentDistance / gestureState.current.initialDistance;
            const newScale = Math.max(0.25, Math.min(3, gestureState.current.startScale * scaleChange));
            setOverlayScale(newScale);
            
            // Calculate rotation change
            const angleChange = currentAngle - gestureState.current.initialAngle;
            const newRotation = gestureState.current.startRotation + angleChange;
            setOverlayRotation(newRotation);
          }
          
          // Also allow panning during multi-touch
          const newX = gestureState.current.startX + gs.dx;
          const newY = gestureState.current.startY + gs.dy;
          setOverlayPosition(newX, newY);
        } else {
          // Single touch: just drag
          const newX = gestureState.current.startX + gs.dx;
          const newY = gestureState.current.startY + gs.dy;
          setOverlayPosition(newX, newY);
        }
      },
      onPanResponderRelease: () => {
        // Update gesture state for next interaction
        gestureState.current.startX = overlayX;
        gestureState.current.startY = overlayY;
        gestureState.current.startScale = overlayScale;
        gestureState.current.startRotation = overlayRotation;
      },
    })
  ).current;

  // Run local comparison when overlay position/scale changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runLocalComparison();
    }, 500);
    return () => clearTimeout(timer);
  }, [overlayX, overlayY, overlayScale]);

  const runLocalComparison = async () => {
    if (!baseImage || !croppedImage) return;
    
    setIsComparing(true);
    try {
      const result = await localComparison({
        base_image: baseImage,
        overlay_image: croppedImage,
        overlay_x: Math.round(overlayX),
        overlay_y: Math.round(overlayY),
        overlay_width: Math.round(croppedWidth * overlayScale),
        overlay_height: Math.round(croppedHeight * overlayScale),
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

  const handleSaveReport = async () => {
    if (!baseImage || !croppedImage) return;
    
    setGeneratingPDF(true);
    try {
      const result = await generateOverlayPDF({
        base_image: baseImage,
        overlay_image: croppedImage,
        overlay_x: Math.round(overlayX),
        overlay_y: Math.round(overlayY),
        overlay_width: Math.round(croppedWidth * overlayScale),
        overlay_height: Math.round(croppedHeight * overlayScale),
        overlay_alpha: overlayAlpha,
        local_ssim: localSSIM,
        edge_overlap: edgeOverlap,
      });
      
      const fileUri = `${FileSystem.documentDirectory}${result.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, result.pdf_base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Overlay Report',
        });
      } else if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${result.pdf_base64}`;
        link.download = result.filename;
        link.click();
      }
    } catch (error) {
      console.error('PDF error:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleReset = () => {
    setOverlayPosition(50, 50);
    setOverlayScale(1.0);
    setOverlayRotation(0);
    setOverlayAlpha(0.7);
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Overlay',
      'Are you sure you want to remove the overlay?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            resetOverlay();
            router.back();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    resetAll();
    router.replace('/');
  };

  // Quick rotation buttons
  const rotateBy = (degrees: number) => {
    setOverlayRotation(overlayRotation + degrees);
  };

  // Simple 50% threshold: green if >= 50%, red if < 50%
  const getScoreColor = (score: number) => {
    return score >= 50 ? '#22c55e' : '#ef4444';
  };

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

      {/* Gesture Instructions */}
      <View style={styles.gestureHint}>
        <Text style={styles.gestureHintText}>
          Drag to move • Pinch to zoom • Two-finger rotate
        </Text>
      </View>

      {/* Main Image Area */}
      <View style={styles.imageArea}>
        {/* Base Image */}
        <Image
          source={{ uri: baseImage }}
          style={styles.baseImage}
          resizeMode="contain"
          onLayout={(e) => setImageLayout(e.nativeEvent.layout)}
        />

        {/* Grid Overlay */}
        {showGrid && (
          <View style={styles.gridOverlay} pointerEvents="none">
            {[...Array(10)].map((_, i) => (
              <View key={`v${i}`} style={[styles.gridLine, styles.gridVertical, { left: `${(i + 1) * 10}%` }]} />
            ))}
            {[...Array(10)].map((_, i) => (
              <View key={`h${i}`} style={[styles.gridLine, styles.gridHorizontal, { top: `${(i + 1) * 10}%` }]} />
            ))}
          </View>
        )}

        {/* Crosshair */}
        {showCrosshair && (
          <View style={styles.crosshairContainer} pointerEvents="none">
            <View style={[styles.crosshairLine, styles.crosshairVertical]} />
            <View style={[styles.crosshairLine, styles.crosshairHorizontal]} />
          </View>
        )}

        {/* Heatmap (if enabled and available) */}
        {showHeatmap && differenceHeatmap && (
          <Image
            source={{ uri: `data:image/png;base64,${differenceHeatmap}` }}
            style={[
              styles.heatmapOverlay,
              {
                left: overlayX,
                top: overlayY,
                width: croppedWidth * overlayScale,
                height: croppedHeight * overlayScale,
                transform: [{ rotate: `${overlayRotation}deg` }],
              },
            ]}
            resizeMode="stretch"
          />
        )}

        {/* Draggable, Scalable, Rotatable Overlay Image */}
        <View
          {...overlayPanResponder.panHandlers}
          style={[
            styles.overlayContainer,
            {
              left: overlayX,
              top: overlayY,
              width: croppedWidth * overlayScale,
              height: croppedHeight * overlayScale,
              opacity: overlayAlpha,
              transform: [{ rotate: `${overlayRotation}deg` }],
            },
          ]}
        >
          <Image
            source={{ uri: croppedImage }}
            style={styles.overlayImage}
            resizeMode="stretch"
          />
          {/* Border indicator */}
          <View style={styles.overlayBorder} />
          {/* Rotation indicator */}
          <View style={styles.rotationIndicator}>
            <Ionicons name="sync" size={16} color="#3b82f6" />
          </View>
        </View>
      </View>

      {/* Control Panel */}
      <ScrollView style={styles.controlPanel} contentContainerStyle={styles.controlContent}>
        {/* Local Comparison Scores */}
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
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Rotation</Text>
            <Text style={styles.sliderValue}>{overlayRotation.toFixed(1)}°</Text>
          </View>
          <View style={styles.rotationControls}>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(-15)}>
              <Ionicons name="arrow-undo" size={18} color="#f8fafc" />
              <Text style={styles.rotateButtonText}>-15°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(-5)}>
              <Text style={styles.rotateButtonText}>-5°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(-1)}>
              <Text style={styles.rotateButtonText}>-1°</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.rotateButton, styles.rotateResetButton]} 
              onPress={() => setOverlayRotation(0)}
            >
              <Text style={styles.rotateButtonText}>0°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(1)}>
              <Text style={styles.rotateButtonText}>+1°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(5)}>
              <Text style={styles.rotateButtonText}>+5°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateButton} onPress={() => rotateBy(15)}>
              <Ionicons name="arrow-redo" size={18} color="#f8fafc" />
              <Text style={styles.rotateButtonText}>+15°</Text>
            </TouchableOpacity>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={-180}
            maximumValue={180}
            value={overlayRotation}
            onValueChange={setOverlayRotation}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#334155"
            thumbTintColor="#3b82f6"
          />
        </View>

        {/* Scale Slider */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Scale (Pinch to zoom)</Text>
            <Text style={styles.sliderValue}>{Math.round(overlayScale * 100)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0.25}
            maximumValue={3}
            value={overlayScale}
            onValueChange={setOverlayScale}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#334155"
            thumbTintColor="#3b82f6"
          />
        </View>

        {/* Alpha Slider */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Transparency</Text>
            <Text style={styles.sliderValue}>{Math.round(overlayAlpha * 100)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0.1}
            maximumValue={1}
            value={overlayAlpha}
            onValueChange={setOverlayAlpha}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#334155"
            thumbTintColor="#3b82f6"
          />
        </View>

        {/* Toggle Options */}
        <View style={styles.togglesRow}>
          <TouchableOpacity
            style={[styles.toggleButton, showGrid && styles.toggleActive]}
            onPress={toggleGrid}
          >
            <Ionicons name="grid-outline" size={18} color={showGrid ? '#fff' : '#94a3b8'} />
            <Text style={[styles.toggleText, showGrid && styles.toggleTextActive]}>Grid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showCrosshair && styles.toggleActive]}
            onPress={toggleCrosshair}
          >
            <Ionicons name="locate-outline" size={18} color={showCrosshair ? '#fff' : '#94a3b8'} />
            <Text style={[styles.toggleText, showCrosshair && styles.toggleTextActive]}>Center</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showHeatmap && styles.toggleActive]}
            onPress={toggleHeatmap}
          >
            <Ionicons name="flame-outline" size={18} color={showHeatmap ? '#fff' : '#94a3b8'} />
            <Text style={[styles.toggleText, showHeatmap && styles.toggleTextActive]}>Heatmap</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={18} color="#f8fafc" />
            <Text style={styles.actionButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleRemove}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {/* Save Report */}
        <TouchableOpacity
          style={[styles.saveButton, generatingPDF && styles.disabledButton]}
          onPress={handleSaveReport}
          disabled={generatingPDF}
        >
          {generatingPDF ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Overlay Report</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Position Info */}
        <View style={styles.positionInfo}>
          <Text style={styles.positionText}>
            Pos: ({Math.round(overlayX)}, {Math.round(overlayY)}) | 
            Size: {Math.round(croppedWidth * overlayScale)} × {Math.round(croppedHeight * overlayScale)} | 
            Rot: {overlayRotation.toFixed(1)}°
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  gestureHint: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  gestureHintText: {
    fontSize: 12,
    color: '#3b82f6',
    textAlign: 'center',
  },
  imageArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  gridVertical: {
    width: 1,
    top: 0,
    bottom: 0,
  },
  gridHorizontal: {
    height: 1,
    left: 0,
    right: 0,
  },
  crosshairContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
  },
  crosshairVertical: {
    width: 1,
    height: '100%',
  },
  crosshairHorizontal: {
    height: 1,
    width: '100%',
  },
  heatmapOverlay: {
    position: 'absolute',
    opacity: 0.5,
  },
  overlayContainer: {
    position: 'absolute',
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  overlayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  rotationIndicator: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  controlPanel: {
    maxHeight: SCREEN_HEIGHT * 0.42,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  controlContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#f8fafc',
  },
  sliderValue: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rotationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 4,
  },
  rotateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 6,
    gap: 2,
  },
  rotateResetButton: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  rotateButtonText: {
    fontSize: 11,
    color: '#f8fafc',
    fontWeight: '500',
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  toggleTextActive: {
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  positionInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  positionText: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
