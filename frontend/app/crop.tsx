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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useOverlayStore } from '../store/overlayStore';
import { cropRegion } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CropSelectionScreen() {
  const router = useRouter();
  const {
    sourceImage,
    setCropRect,
    setCroppedImage,
    toggleCropMode,
    toggleOverlayMode,
    isCropping,
    setIsCropping,
  } = useOverlayStore();

  const [imageLayout, setImageLayout] = useState({ width: 300, height: 400 });
  const [imageSize, setImageSize] = useState({ width: 1000, height: 1000 });

  // Animated values for crop box
  const cropX = useSharedValue(50);
  const cropY = useSharedValue(50);
  const cropWidth = useSharedValue(200);
  const cropHeight = useSharedValue(150);

  // Context values to track gesture start positions
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  const MIN_SIZE = 50;

  // Get actual image dimensions
  useEffect(() => {
    if (sourceImage) {
      Image.getSize(
        sourceImage,
        (width, height) => {
          console.log('Image dimensions:', width, height);
          setImageSize({ width, height });
        },
        (error) => console.error('Failed to get image size:', error)
      );
    }
  }, [sourceImage]);

  // Initialize crop box when layout changes
  const handleImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    console.log('Layout:', width, height);
    setImageLayout({ width, height });
    
    // Center the crop box
    cropX.value = width * 0.15;
    cropY.value = height * 0.15;
    cropWidth.value = width * 0.7;
    cropHeight.value = height * 0.5;
  };

  // Gesture for moving the entire crop box
  const moveGesture = Gesture.Pan()
    .onUpdate((e) => {
      const newX = cropX.value + e.translationX;
      const newY = cropY.value + e.translationY;
      
      // Constrain to bounds
      cropX.value = Math.max(0, Math.min(newX, imageLayout.width - cropWidth.value));
      cropY.value = Math.max(0, Math.min(newY, imageLayout.height - cropHeight.value));
    })
    .onEnd(() => {
      // Reset translation
    });

  // Gesture for resizing from corners
  const createCornerGesture = (corner: string) => {
    return Gesture.Pan()
      .onUpdate((e) => {
        const dx = e.translationX;
        const dy = e.translationY;

        switch (corner) {
          case 'tl':
            const newXTL = cropX.value + dx;
            const newYTL = cropY.value + dy;
            const newWTL = cropWidth.value - dx;
            const newHTL = cropHeight.value - dy;
            if (newWTL >= MIN_SIZE && newHTL >= MIN_SIZE && newXTL >= 0 && newYTL >= 0) {
              cropX.value = newXTL;
              cropY.value = newYTL;
              cropWidth.value = newWTL;
              cropHeight.value = newHTL;
            }
            break;
          case 'tr':
            const newYTR = cropY.value + dy;
            const newWTR = cropWidth.value + dx;
            const newHTR = cropHeight.value - dy;
            if (newWTR >= MIN_SIZE && newHTR >= MIN_SIZE && newYTR >= 0) {
              cropY.value = newYTR;
              cropWidth.value = Math.min(newWTR, imageLayout.width - cropX.value);
              cropHeight.value = newHTR;
            }
            break;
          case 'bl':
            const newXBL = cropX.value + dx;
            const newWBL = cropWidth.value - dx;
            const newHBL = cropHeight.value + dy;
            if (newWBL >= MIN_SIZE && newHBL >= MIN_SIZE && newXBL >= 0) {
              cropX.value = newXBL;
              cropWidth.value = newWBL;
              cropHeight.value = Math.min(newHBL, imageLayout.height - cropY.value);
            }
            break;
          case 'br':
            const newWBR = cropWidth.value + dx;
            const newHBR = cropHeight.value + dy;
            if (newWBR >= MIN_SIZE && newHBR >= MIN_SIZE) {
              cropWidth.value = Math.min(newWBR, imageLayout.width - cropX.value);
              cropHeight.value = Math.min(newHBR, imageLayout.height - cropY.value);
            }
            break;
        }
      });
  };

  const tlGesture = createCornerGesture('tl');
  const trGesture = createCornerGesture('tr');
  const blGesture = createCornerGesture('bl');
  const brGesture = createCornerGesture('br');

  // Animated styles
  const cropBoxStyle = useAnimatedStyle(() => ({
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
  }));

  const darkTopStyle = useAnimatedStyle(() => ({
    height: cropY.value,
  }));

  const darkBottomStyle = useAnimatedStyle(() => ({
    top: cropY.value + cropHeight.value,
  }));

  const darkLeftStyle = useAnimatedStyle(() => ({
    top: cropY.value,
    width: cropX.value,
    height: cropHeight.value,
  }));

  const darkRightStyle = useAnimatedStyle(() => ({
    top: cropY.value,
    left: cropX.value + cropWidth.value,
    height: cropHeight.value,
  }));

  const handleConfirmCrop = async () => {
    if (!sourceImage) {
      Alert.alert('Error', 'No source image available');
      return;
    }

    setIsCropping(true);

    try {
      // Calculate scale factor
      const scaleX = imageSize.width / imageLayout.width;
      const scaleY = imageSize.height / imageLayout.height;

      const actualX = Math.round(cropX.value * scaleX);
      const actualY = Math.round(cropY.value * scaleY);
      const actualW = Math.round(cropWidth.value * scaleX);
      const actualH = Math.round(cropHeight.value * scaleY);

      console.log('Cropping:', { actualX, actualY, actualW, actualH });

      // Update store
      setCropRect({
        x: cropX.value,
        y: cropY.value,
        width: cropWidth.value,
        height: cropHeight.value,
      });

      const result = await cropRegion({
        image_base64: sourceImage,
        crop_x: actualX,
        crop_y: actualY,
        crop_width: actualW,
        crop_height: actualH,
      });

      console.log('Crop result:', result.width, result.height);

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
      Alert.alert('Error', `Failed to crop: ${error.message || 'Unknown error'}`);
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Region</Text>
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
            Drag box to move • Drag corners to resize
          </Text>
        </View>

        {/* Image Container */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: sourceImage }}
            style={styles.image}
            resizeMode="contain"
            onLayout={handleImageLayout}
          />

          {/* Dark overlays */}
          <Animated.View style={[styles.darkOverlay, styles.darkTop, darkTopStyle]} />
          <Animated.View style={[styles.darkOverlay, styles.darkBottom, darkBottomStyle]} />
          <Animated.View style={[styles.darkOverlay, darkLeftStyle]} />
          <Animated.View style={[styles.darkOverlay, styles.darkRight, darkRightStyle]} />

          {/* Crop Box - Draggable */}
          <GestureDetector gesture={moveGesture}>
            <Animated.View style={[styles.cropBox, cropBoxStyle]}>
              <View style={styles.cropBorder} />
              {/* Grid */}
              <View style={[styles.gridLine, { left: '33%', top: 0, bottom: 0, width: 1 }]} />
              <View style={[styles.gridLine, { left: '66%', top: 0, bottom: 0, width: 1 }]} />
              <View style={[styles.gridLine, { top: '33%', left: 0, right: 0, height: 1 }]} />
              <View style={[styles.gridLine, { top: '66%', left: 0, right: 0, height: 1 }]} />
            </Animated.View>
          </GestureDetector>

          {/* Corner Handles */}
          <GestureDetector gesture={tlGesture}>
            <Animated.View style={[styles.handle, useAnimatedStyle(() => ({
              left: cropX.value - 15,
              top: cropY.value - 15,
            }))]} />
          </GestureDetector>

          <GestureDetector gesture={trGesture}>
            <Animated.View style={[styles.handle, useAnimatedStyle(() => ({
              left: cropX.value + cropWidth.value - 15,
              top: cropY.value - 15,
            }))]} />
          </GestureDetector>

          <GestureDetector gesture={blGesture}>
            <Animated.View style={[styles.handle, useAnimatedStyle(() => ({
              left: cropX.value - 15,
              top: cropY.value + cropHeight.value - 15,
            }))]} />
          </GestureDetector>

          <GestureDetector gesture={brGesture}>
            <Animated.View style={[styles.handle, useAnimatedStyle(() => ({
              left: cropX.value + cropWidth.value - 15,
              top: cropY.value + cropHeight.value - 15,
            }))]} />
          </GestureDetector>
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
    </GestureHandlerRootView>
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
    color: '#3b82f6',
    textAlign: 'center',
    fontWeight: '500',
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
  darkTop: {
    top: 0,
    left: 0,
    right: 0,
  },
  darkBottom: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  darkRight: {
    right: 0,
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: '#3b82f6',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 10,
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
