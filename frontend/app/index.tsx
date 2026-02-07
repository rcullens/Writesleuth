import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, HistoryItem } from '../store/appStore';
import { compareHandwriting, getHistory } from '../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const {
    questionedImage,
    knownImage,
    isComparing,
    history,
    setQuestionedImage,
    setKnownImage,
    setIsComparing,
    setCurrentResult,
    setHistory,
    setError,
    clearImages,
  } = useAppStore();

  const [useAI, setUseAI] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const historyData = await getHistory(5);
      setHistory(historyData);
    } catch (e) {
      console.log('Failed to load history:', e);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library permissions are needed to use this app.'
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (type: 'questioned' | 'known', source: 'camera' | 'gallery') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    let result;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    };

    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'questioned') {
        setQuestionedImage(base64Image);
      } else {
        setKnownImage(base64Image);
      }
    }
  };

  const showImageOptions = (type: 'questioned' | 'known') => {
    Alert.alert(
      'Select Image Source',
      `Choose how to add the ${type === 'questioned' ? 'Questioned Document' : 'Known Sample'}`,
      [
        { text: 'Camera', onPress: () => pickImage(type, 'camera') },
        { text: 'Gallery', onPress: () => pickImage(type, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCompare = async () => {
    if (!questionedImage || !knownImage) {
      Alert.alert('Missing Images', 'Please add both handwriting samples before comparing.');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const result = await compareHandwriting(questionedImage, knownImage, useAI);
      setCurrentResult(result);
      await loadHistory();
      router.push('/results');
    } catch (e: any) {
      console.error('Comparison error:', e);
      setError(e.message || 'Failed to compare handwriting samples');
      Alert.alert('Error', 'Failed to compare handwriting samples. Please try again.');
    } finally {
      setIsComparing(false);
    }
  };

  const renderImageDropZone = (type: 'questioned' | 'known') => {
    const image = type === 'questioned' ? questionedImage : knownImage;
    const label = type === 'questioned' ? 'Questioned Document' : 'Known Sample';
    const sublabel = type === 'questioned' ? '(QD)' : '(K)';
    const color = type === 'questioned' ? '#f97316' : '#22c55e';

    return (
      <TouchableOpacity
        style={[styles.dropZone, { borderColor: color }]}
        onPress={() => showImageOptions(type)}
        activeOpacity={0.7}
      >
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: color }]}
              onPress={() => type === 'questioned' ? setQuestionedImage(null) : setKnownImage(null)}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.dropZoneContent}>
            <Ionicons name="document-text-outline" size={40} color={color} />
            <Text style={[styles.dropZoneLabel, { color }]}>{label}</Text>
            <Text style={styles.dropZoneSublabel}>{sublabel}</Text>
            <Text style={styles.tapToAdd}>Tap to add image</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = (item: HistoryItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.historyCard}
      onPress={() => router.push({ pathname: '/history', params: { id: item.id } })}
    >
      <View style={styles.historyImages}>
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.questioned_thumb}` }}
          style={styles.historyThumb}
        />
        <Ionicons name="arrow-forward" size={16} color="#64748b" />
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.known_thumb}` }}
          style={styles.historyThumb}
        />
      </View>
      <View style={styles.historyInfo}>
        <Text style={[styles.historyScore, { color: item.verdict_color }]}>
          {item.composite_score.toFixed(1)}%
        </Text>
        <Text style={styles.historyDate}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/help')}>
            <Ionicons name="help-circle-outline" size={24} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/history')}>
            <Ionicons name="time-outline" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Ionicons name="finger-print" size={48} color="#3b82f6" />
          <Text style={styles.title}>Forensic Comparator</Text>
          <Text style={styles.subtitle}>Handwriting Analysis Tool</Text>
        </View>

        {/* Image Drop Zones */}
        <View style={styles.dropZonesContainer}>
          {renderImageDropZone('questioned')}
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          {renderImageDropZone('known')}
        </View>

        {/* AI Toggle */}
        <TouchableOpacity
          style={styles.aiToggle}
          onPress={() => setUseAI(!useAI)}
        >
          <Ionicons
            name={useAI ? 'checkbox' : 'square-outline'}
            size={24}
            color={useAI ? '#3b82f6' : '#64748b'}
          />
          <Text style={styles.aiToggleText}>Use AI Deep Analysis (Grok Vision)</Text>
        </TouchableOpacity>

        {/* Compare Button */}
        <TouchableOpacity
          style={[
            styles.compareButton,
            (!questionedImage || !knownImage) && styles.compareButtonDisabled,
          ]}
          onPress={handleCompare}
          disabled={isComparing || !questionedImage || !knownImage}
        >
          {isComparing ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.compareButtonText}>Analyzing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={24} color="#fff" />
              <Text style={styles.compareButtonText}>Compare Handwriting</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Clear Button */}
        {(questionedImage || knownImage) && (
          <TouchableOpacity style={styles.clearButton} onPress={clearImages}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.clearButtonText}>Clear Images</Text>
          </TouchableOpacity>
        )}

        {/* Recent Comparisons */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={styles.historySectionTitle}>Recent Comparisons</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {history.map(renderHistoryItem)}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 8,
  },
  headerButton: {
    padding: 8,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  dropZonesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dropZone: {
    width: '44%',
    aspectRatio: 0.8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropZoneContent: {
    alignItems: 'center',
    padding: 12,
  },
  dropZoneLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  dropZoneSublabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  tapToAdd: {
    fontSize: 10,
    color: '#475569',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  aiToggleText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  compareButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  compareButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  compareButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ef4444',
  },
  historySection: {
    marginTop: 32,
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  viewAllText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  historyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 160,
  },
  historyImages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  historyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyScore: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyDate: {
    fontSize: 10,
    color: '#64748b',
  },
});
