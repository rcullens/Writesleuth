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
import { STEAMPUNK_COLORS as C } from '../styles/theme';

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

  // Gesture for moving the entire crop box - FIXED: save start position and use delta
  const moveGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = cropX.value;
      startY.value = cropY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const newX = startX.value + e.translationX;
      const newY = startY.value + e.translationY;
      
      // Constrain to bounds
      cropX.value = Math.max(0, Math.min(newX, imageLayout.width - cropWidth.value));
      cropY.value = Math.max(0, Math.min(newY, imageLayout.height - cropHeight.value));
    });

  // Gesture for resizing from corners - FIXED: save all start values
  const createCornerGesture = (corner: string) => {
    return Gesture.Pan()
      .onStart(() => {
        'worklet';
        startX.value = cropX.value;
        startY.value = cropY.value;
        startW.value = cropWidth.value;
        startH.value = cropHeight.value;
      })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX;
        const dy = e.translationY;

        switch (corner) {
          case 'tl': {
            const newX = startX.value + dx;
            const newY = startY.value + dy;
            const newW = startW.value - dx;
            const newH = startH.value - dy;
            if (newW >= MIN_SIZE && newH >= MIN_SIZE && newX >= 0 && newY >= 0) {
              cropX.value = newX;
              cropY.value = newY;
              cropWidth.value = newW;
              cropHeight.value = newH;
            }
            break;
          }
          case 'tr': {
            const newY = startY.value + dy;
            const newW = startW.value + dx;
            const newH = startH.value - dy;
            if (newW >= MIN_SIZE && newH >= MIN_SIZE && newY >= 0) {
              cropY.value = newY;
              cropWidth.value = Math.min(newW, imageLayout.width - startX.value);
              cropHeight.value = newH;
            }
            break;
          }
          case 'bl': {
            const newX = startX.value + dx;
            const newW = startW.value - dx;
            const newH = startH.value + dy;
            if (newW >= MIN_SIZE && newH >= MIN_SIZE && newX >= 0) {
              cropX.value = newX;
              cropWidth.value = newW;
              cropHeight.value = Math.min(newH, imageLayout.height - startY.value);
            }
            break;
          }
          case 'br': {
            const newW = startW.value + dx;
            const newH = startH.value + dy;
            if (newW >= MIN_SIZE && newH >= MIN_SIZE) {
              cropWidth.value = Math.min(newW, imageLayout.width - startX.value);
              cropHeight.value = Math.min(newH, imageLayout.height - startY.value);
            }
            break;
          }
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
          <Ionicons name="image-outline" size={64} color={C.textDim} />
          <Text style={styles.emptyText}>No specimen to crop</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backButtonText}>Return to Lab</Text>
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
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton} data-testid="cancel-crop-btn">
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerLabel}>SPECIMEN EXTRACTION</Text>
            <Text style={styles.headerTitle}>Select Region</Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirmCrop}
            style={[styles.headerButton, styles.confirmButton]}
            disabled={isCropping}
            data-testid="confirm-crop-btn"
          >
            {isCropping ? (
              <ActivityIndicator size="small" color={C.bgDark} />
            ) : (
              <Ionicons name="checkmark" size={24} color={C.bgDark} />
            )}
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Ionicons name="move" size={14} color={C.brass} />
          <Text style={styles.instructionText}>
            Drag box to move  •  Drag corners to resize
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

          {/* Corner Handles - Brass Style */}
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
            data-testid="crop-overlay-btn"
          >
            {isCropping ? (
              <>
                <ActivityIndicator size="small" color={C.bgDark} />
                <Text style={styles.cropButtonText}>EXTRACTING...</Text>
              </>
            ) : (
              <>
                <Ionicons name="crop" size={20} color={C.bgDark} />
                <Text style={styles.cropButtonText}>EXTRACT & OVERLAY</Text>
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
    backgroundColor: C.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgPanel,
  },
  headerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  confirmButton: {
    backgroundColor: C.brass,
    borderColor: C.brassLight,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 9,
    color: C.brass,
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: C.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  instructionText: {
    fontSize: 12,
    color: C.brass,
    fontWeight: '500',
    letterSpacing: 1,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    margin: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(13, 9, 7, 0.7)',
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
    borderColor: C.brass,
    backgroundColor: 'transparent',
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: C.brass + '40',
  },
  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: C.brass,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: C.brassLight,
    zIndex: 10,
    shadowColor: C.brass,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: C.bgPanel,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: C.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 1,
  },
  cropButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: C.brass,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: C.brassLight,
  },
  cropButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.bgDark,
    letterSpacing: 1,
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
    fontSize: 16,
    color: C.textDim,
    marginTop: 16,
    letterSpacing: 1,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.brass,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.brassLight,
  },
  backButtonText: {
    color: C.bgDark,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
