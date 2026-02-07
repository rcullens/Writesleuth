import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOverlayStore } from '../store/overlayStore';
import { cropRegion } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_AREA_HEIGHT = SCREEN_HEIGHT * 0.65;

export default function CropSelectionScreen() {
  const router = useRouter();
  const {
    sourceImage,
    cropRect,
    setCropRect,
    setCroppedImage,
    toggleCropMode,
    toggleOverlayMode,
    isCropping,
    setIsCropping,
  } = useOverlayStore();

  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const startPos = useRef({ x: 0, y: 0, rect: cropRect });

  const MIN_SIZE = 30;

  // Handle dragging the crop box or handles
  const handlePanResponderMove = (gestureState: any) => {
    const { dx, dy } = gestureState;
    const { x: startX, y: startY, rect: startRect } = startPos.current;

    if (activeHandle === 'move') {
      // Move entire box
      let newX = startRect.x + dx;
      let newY = startRect.y + dy;
      
      // Constrain to image bounds
      newX = Math.max(0, Math.min(newX, imageLayout.width - startRect.width));
      newY = Math.max(0, Math.min(newY, imageLayout.height - startRect.height));
      
      setCropRect({ ...startRect, x: newX, y: newY });
    } else if (activeHandle) {
      // Resize from handles
      let { x, y, width, height } = startRect;
      
      switch (activeHandle) {
        case 'tl': // Top-left
          x = startRect.x + dx;
          y = startRect.y + dy;
          width = startRect.width - dx;
          height = startRect.height - dy;
          break;
        case 'tr': // Top-right
          y = startRect.y + dy;
          width = startRect.width + dx;
          height = startRect.height - dy;
          break;
        case 'bl': // Bottom-left
          x = startRect.x + dx;
          width = startRect.width - dx;
          height = startRect.height + dy;
          break;
        case 'br': // Bottom-right
          width = startRect.width + dx;
          height = startRect.height + dy;
          break;
        case 't': // Top
          y = startRect.y + dy;
          height = startRect.height - dy;
          break;
        case 'b': // Bottom
          height = startRect.height + dy;
          break;
        case 'l': // Left
          x = startRect.x + dx;
          width = startRect.width - dx;
          break;
        case 'r': // Right
          width = startRect.width + dx;
          break;
      }
      
      // Enforce minimum size
      if (width >= MIN_SIZE && height >= MIN_SIZE) {
        // Constrain to image bounds
        x = Math.max(0, x);
        y = Math.max(0, y);
        width = Math.min(width, imageLayout.width - x);
        height = Math.min(height, imageLayout.height - y);
        
        setCropRect({ x, y, width, height });
      }
    }
  };

  const createPanResponder = (handle: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setActiveHandle(handle);
        startPos.current = {
          x: gestureState.x0,
          y: gestureState.y0,
          rect: { ...cropRect },
        };
      },
      onPanResponderMove: (_, gestureState) => {
        handlePanResponderMove(gestureState);
      },
      onPanResponderRelease: () => {
        setActiveHandle(null);
      },
    });
  };

  const movePanResponder = createPanResponder('move');
  const tlPanResponder = createPanResponder('tl');
  const trPanResponder = createPanResponder('tr');
  const blPanResponder = createPanResponder('bl');
  const brPanResponder = createPanResponder('br');
  const tPanResponder = createPanResponder('t');
  const bPanResponder = createPanResponder('b');
  const lPanResponder = createPanResponder('l');
  const rPanResponder = createPanResponder('r');

  const handleImageLayout = (event: any) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageLayout({ width, height, x, y });
    
    // Initialize crop rect to center of image
    if (cropRect.x === 50 && cropRect.y === 50) {
      setCropRect({
        x: width * 0.2,
        y: height * 0.2,
        width: width * 0.6,
        height: height * 0.4,
      });
    }
  };

  const handleConfirmCrop = async () => {
    if (!sourceImage) return;
    
    // Calculate actual pixel coordinates based on image size ratio
    // For now, we'll use the crop rect as-is since we're working with displayed image
    setIsCropping(true);
    
    try {
      const result = await cropRegion({
        image_base64: sourceImage,
        crop_x: Math.round(cropRect.x * (1000 / imageLayout.width)), // Scale to ~1000px reference
        crop_y: Math.round(cropRect.y * (1000 / imageLayout.height)),
        crop_width: Math.round(cropRect.width * (1000 / imageLayout.width)),
        crop_height: Math.round(cropRect.height * (1000 / imageLayout.height)),
      });
      
      setCroppedImage(
        `data:image/png;base64,${result.cropped_solid}`,
        result.width,
        result.height
      );
      
      toggleCropMode(false);
      toggleOverlayMode(true);
      router.replace('/overlay');
    } catch (error: any) {
      console.error('Crop error:', error);
      Alert.alert('Error', 'Failed to crop region. Please try again.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleCancel = () => {
    toggleCropMode(false);
    router.back();
  };

  if (!sourceImage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="image-outline" size={64} color="#64748b" />
          <Text style={styles.emptyText}>No image to crop</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Region to Compare</Text>
        <TouchableOpacity 
          onPress={handleConfirmCrop} 
          style={[styles.headerButton, styles.confirmButton]}
          disabled={isCropping}
        >
          {isCropping ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Drag corners or edges to resize. Drag inside to move.
        </Text>
      </View>

      {/* Image with Crop Overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: sourceImage }}
          style={styles.image}
          resizeMode="contain"
          onLayout={handleImageLayout}
        />
        
        {/* Dark overlay outside crop area */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* Top overlay */}
          <View style={[styles.darkOverlay, { 
            top: 0, 
            left: 0, 
            right: 0, 
            height: cropRect.y 
          }]} />
          {/* Bottom overlay */}
          <View style={[styles.darkOverlay, { 
            top: cropRect.y + cropRect.height, 
            left: 0, 
            right: 0, 
            bottom: 0 
          }]} />
          {/* Left overlay */}
          <View style={[styles.darkOverlay, { 
            top: cropRect.y, 
            left: 0, 
            width: cropRect.x, 
            height: cropRect.height 
          }]} />
          {/* Right overlay */}
          <View style={[styles.darkOverlay, { 
            top: cropRect.y, 
            left: cropRect.x + cropRect.width, 
            right: 0, 
            height: cropRect.height 
          }]} />
        </View>

        {/* Crop Box */}
        <View
          style={[
            styles.cropBox,
            {
              left: cropRect.x,
              top: cropRect.y,
              width: cropRect.width,
              height: cropRect.height,
            },
          ]}
          {...movePanResponder.panHandlers}
        >
          {/* Border */}
          <View style={styles.cropBorder} />
          
          {/* Grid lines */}
          <View style={styles.gridContainer}>
            <View style={[styles.gridLine, styles.gridVertical, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridVertical, { left: '66%' }]} />
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '66%' }]} />
          </View>

          {/* Corner Handles */}
          <View style={[styles.handle, styles.handleTL]} {...tlPanResponder.panHandlers} />
          <View style={[styles.handle, styles.handleTR]} {...trPanResponder.panHandlers} />
          <View style={[styles.handle, styles.handleBL]} {...blPanResponder.panHandlers} />
          <View style={[styles.handle, styles.handleBR]} {...brPanResponder.panHandlers} />
          
          {/* Edge Handles */}
          <View style={[styles.edgeHandle, styles.handleT]} {...tPanResponder.panHandlers} />
          <View style={[styles.edgeHandle, styles.handleB]} {...bPanResponder.panHandlers} />
          <View style={[styles.edgeHandle, styles.handleL]} {...lPanResponder.panHandlers} />
          <View style={[styles.edgeHandle, styles.handleR]} {...rPanResponder.panHandlers} />
        </View>
      </View>

      {/* Size Info */}
      <View style={styles.sizeInfo}>
        <Text style={styles.sizeText}>
          Selection: {Math.round(cropRect.width)} × {Math.round(cropRect.height)} px
        </Text>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.cropButton, isCropping && styles.disabledButton]} 
          onPress={handleConfirmCrop}
          disabled={isCropping}
        >
          {isCropping ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="crop" size={20} color="#fff" />
              <Text style={styles.cropButtonText}>Crop & Overlay</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  confirmButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  instructions: {
    padding: 12,
    backgroundColor: '#1e293b',
  },
  instructionText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    margin: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  darkOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 0,
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
  handle: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  handleTL: { top: -12, left: -12 },
  handleTR: { top: -12, right: -12 },
  handleBL: { bottom: -12, left: -12 },
  handleBR: { bottom: -12, right: -12 },
  edgeHandle: {
    position: 'absolute',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  handleT: { top: -8, left: '40%', width: '20%', height: 16 },
  handleB: { bottom: -8, left: '40%', width: '20%', height: 16 },
  handleL: { left: -8, top: '40%', width: 16, height: '20%' },
  handleR: { right: -8, top: '40%', width: 16, height: '20%' },
  sizeInfo: {
    padding: 12,
    alignItems: 'center',
  },
  sizeText: {
    fontSize: 14,
    color: '#64748b',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cropButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cropButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
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
