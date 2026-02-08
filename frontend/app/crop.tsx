import React, { useState, useRef, useEffect } from 'react';
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

export default function CropSelectionScreen() {
  const router = useRouter();
  const {
    sourceImage,
    baseImage,
    cropRect,
    setCropRect,
    setCroppedImage,
    toggleCropMode,
    toggleOverlayMode,
    isCropping,
    setIsCropping,
  } = useOverlayStore();

  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  const startPos = useRef({ x: 0, y: 0, rect: { x: 50, y: 50, width: 150, height: 100 } });

  const MIN_SIZE = 40;

  // Get actual image dimensions
  useEffect(() => {
    if (sourceImage) {
      Image.getSize(
        sourceImage,
        (width, height) => {
          console.log('Source image dimensions:', width, height);
          setImageSize({ width, height });
        },
        (error) => {
          console.error('Failed to get image size:', error);
        }
      );
    }
  }, [sourceImage]);

  // Initialize crop rect when image layout is ready
  useEffect(() => {
    if (imageLayout.width > 0 && imageLayout.height > 0 && !isInitialized) {
      const initialRect = {
        x: imageLayout.width * 0.15,
        y: imageLayout.height * 0.15,
        width: imageLayout.width * 0.7,
        height: imageLayout.height * 0.5,
      };
      setCropRect(initialRect);
      startPos.current.rect = initialRect;
      setIsInitialized(true);
      console.log('Initialized crop rect:', initialRect);
    }
  }, [imageLayout, isInitialized]);

  // Create pan responder for moving and resizing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPos.current = {
          x: 0,
          y: 0,
          rect: { ...cropRect },
        };
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const { rect: startRect } = startPos.current;
        
        let newX = startRect.x + dx;
        let newY = startRect.y + dy;
        
        // Constrain to image bounds
        newX = Math.max(0, Math.min(newX, imageLayout.width - startRect.width));
        newY = Math.max(0, Math.min(newY, imageLayout.height - startRect.height));
        
        setCropRect({ ...startRect, x: newX, y: newY });
      },
      onPanResponderRelease: () => {
        startPos.current.rect = { ...cropRect };
      },
    })
  ).current;

  // Handle resize from corners
  const handleResize = (corner: string, dx: number, dy: number) => {
    const { rect: startRect } = startPos.current;
    let { x, y, width, height } = startRect;

    switch (corner) {
      case 'tl':
        x = startRect.x + dx;
        y = startRect.y + dy;
        width = startRect.width - dx;
        height = startRect.height - dy;
        break;
      case 'tr':
        y = startRect.y + dy;
        width = startRect.width + dx;
        height = startRect.height - dy;
        break;
      case 'bl':
        x = startRect.x + dx;
        width = startRect.width - dx;
        height = startRect.height + dy;
        break;
      case 'br':
        width = startRect.width + dx;
        height = startRect.height + dy;
        break;
    }

    // Enforce minimum size and bounds
    if (width >= MIN_SIZE && height >= MIN_SIZE) {
      x = Math.max(0, x);
      y = Math.max(0, y);
      width = Math.min(width, imageLayout.width - x);
      height = Math.min(height, imageLayout.height - y);
      setCropRect({ x, y, width, height });
    }
  };

  const createCornerResponder = (corner: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPos.current = { x: 0, y: 0, rect: { ...cropRect } };
      },
      onPanResponderMove: (_, gestureState) => {
        handleResize(corner, gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: () => {
        startPos.current.rect = { ...cropRect };
      },
    });
  };

  const tlResponder = useRef(createCornerResponder('tl')).current;
  const trResponder = useRef(createCornerResponder('tr')).current;
  const blResponder = useRef(createCornerResponder('bl')).current;
  const brResponder = useRef(createCornerResponder('br')).current;

  const handleImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    console.log('Image layout:', width, height);
    setImageLayout({ width, height });
  };

  const handleConfirmCrop = async () => {
    if (!sourceImage) {
      Alert.alert('Error', 'No source image available');
      return;
    }

    if (imageLayout.width === 0 || imageLayout.height === 0) {
      Alert.alert('Error', 'Image not loaded properly');
      return;
    }

    setIsCropping(true);

    try {
      // Calculate scale factor between displayed image and actual image
      const scaleX = imageSize.width / imageLayout.width;
      const scaleY = imageSize.height / imageLayout.height;

      // Convert crop rect from display coordinates to actual image coordinates
      const actualCropX = Math.round(cropRect.x * scaleX);
      const actualCropY = Math.round(cropRect.y * scaleY);
      const actualCropWidth = Math.round(cropRect.width * scaleX);
      const actualCropHeight = Math.round(cropRect.height * scaleY);

      console.log('Crop request:', {
        displayRect: cropRect,
        actualRect: { x: actualCropX, y: actualCropY, width: actualCropWidth, height: actualCropHeight },
        scale: { scaleX, scaleY },
      });

      const result = await cropRegion({
        image_base64: sourceImage,
        crop_x: actualCropX,
        crop_y: actualCropY,
        crop_width: actualCropWidth,
        crop_height: actualCropHeight,
      });

      console.log('Crop result:', { width: result.width, height: result.height });

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
      Alert.alert('Error', `Failed to crop region: ${error.message || 'Unknown error'}`);
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
          <Text style={styles.emptySubtext}>Please start from the results screen</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backButtonText}>Go to Home</Text>
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
          Drag to move selection. Drag corners to resize.
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

        {imageLayout.width > 0 && (
          <>
            {/* Dark overlay - top */}
            <View
              style={[styles.darkOverlay, { top: 0, left: 0, right: 0, height: cropRect.y }]}
              pointerEvents="none"
            />
            {/* Dark overlay - bottom */}
            <View
              style={[
                styles.darkOverlay,
                { top: cropRect.y + cropRect.height, left: 0, right: 0, bottom: 0 },
              ]}
              pointerEvents="none"
            />
            {/* Dark overlay - left */}
            <View
              style={[
                styles.darkOverlay,
                { top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.height },
              ]}
              pointerEvents="none"
            />
            {/* Dark overlay - right */}
            <View
              style={[
                styles.darkOverlay,
                {
                  top: cropRect.y,
                  left: cropRect.x + cropRect.width,
                  right: 0,
                  height: cropRect.height,
                },
              ]}
              pointerEvents="none"
            />

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
              {...panResponder.panHandlers}
            >
              {/* Border */}
              <View style={styles.cropBorder} />

              {/* Grid lines */}
              <View style={[styles.gridLine, styles.gridV1]} />
              <View style={[styles.gridLine, styles.gridV2]} />
              <View style={[styles.gridLine, styles.gridH1]} />
              <View style={[styles.gridLine, styles.gridH2]} />
            </View>

            {/* Corner Handles */}
            <View
              style={[styles.handle, { left: cropRect.x - 15, top: cropRect.y - 15 }]}
              {...tlResponder.panHandlers}
            />
            <View
              style={[styles.handle, { left: cropRect.x + cropRect.width - 15, top: cropRect.y - 15 }]}
              {...trResponder.panHandlers}
            />
            <View
              style={[styles.handle, { left: cropRect.x - 15, top: cropRect.y + cropRect.height - 15 }]}
              {...blResponder.panHandlers}
            />
            <View
              style={[
                styles.handle,
                { left: cropRect.x + cropRect.width - 15, top: cropRect.y + cropRect.height - 15 },
              ]}
              {...brResponder.panHandlers}
            />
          </>
        )}
      </View>

      {/* Size Info */}
      <View style={styles.sizeInfo}>
        <Text style={styles.sizeText}>
          Selection: {Math.round(cropRect.width)} × {Math.round(cropRect.height)} px
        </Text>
        {imageSize.width > 0 && (
          <Text style={styles.sizeSubtext}>
            Actual: {Math.round(cropRect.width * (imageSize.width / imageLayout.width))} × 
            {Math.round(cropRect.height * (imageSize.height / imageLayout.height))} px
          </Text>
        )}
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
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.cropButtonText}>Cropping...</Text>
            </>
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
    margin: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cropBox: {
    position: 'absolute',
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridV1: {
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridV2: {
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridH1: {
    top: '33.33%',
    left: 0,
    right: 0,
    height: 1,
  },
  gridH2: {
    top: '66.66%',
    left: 0,
    right: 0,
    height: 1,
  },
  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: '#3b82f6',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#fff',
  },
  sizeInfo: {
    padding: 12,
    alignItems: 'center',
  },
  sizeText: {
    fontSize: 14,
    color: '#f8fafc',
  },
  sizeSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
    color: '#f8fafc',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
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
