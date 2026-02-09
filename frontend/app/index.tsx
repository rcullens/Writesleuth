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

// Forensic Lab Colors
const COLORS = {
  bgDark: '#0a0e14',
  bgPanel: '#111922',
  bgCard: '#1a2332',
  accent: '#00d4ff',
  accentDim: '#0891b2',
  accentOrange: '#f97316',
  accentGreen: '#10b981',
  success: '#10b981',
  danger: '#ef4444',
  text: '#e2e8f0',
  textDim: '#64748b',
  border: '#1e3a5f',
};

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
        Alert.alert('Permissions Required', 'Camera and photo library access needed.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async (type: 'questioned' | 'known', source: 'camera' | 'gallery') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    };

    let result = source === 'camera' 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      type === 'questioned' ? setQuestionedImage(base64Image) : setKnownImage(base64Image);
    }
  };

  const showImageOptions = (type: 'questioned' | 'known') => {
    Alert.alert(
      'Acquire Specimen',
      type === 'questioned' ? 'Questioned Document Source' : 'Known Sample Source',
      [
        { text: 'Camera', onPress: () => pickImage(type, 'camera') },
        { text: 'Gallery', onPress: () => pickImage(type, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCompare = async () => {
    if (!questionedImage || !knownImage) {
      Alert.alert('Missing Specimens', 'Both document samples are required for analysis.');
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
      setError(e.message || 'Analysis failed');
      Alert.alert('Analysis Error', 'Failed to complete forensic analysis. Please retry.');
    } finally {
      setIsComparing(false);
    }
  };

  const renderDropZone = (type: 'questioned' | 'known') => {
    const image = type === 'questioned' ? questionedImage : knownImage;
    const label = type === 'questioned' ? 'QUESTIONED' : 'KNOWN';
    const sublabel = type === 'questioned' ? 'Document Under Analysis' : 'Reference Sample';
    const color = type === 'questioned' ? COLORS.accentOrange : COLORS.accentGreen;

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
              style={[styles.removeBtn, { backgroundColor: color }]}
              onPress={() => type === 'questioned' ? setQuestionedImage(null) : setKnownImage(null)}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.zoneLabel, { backgroundColor: color }]}>
              <Text style={styles.zoneLabelText}>{label}</Text>
            </View>
          </>
        ) : (
          <View style={styles.dropZoneContent}>
            <View style={[styles.dropZoneIcon, { borderColor: color }]}>
              <Ionicons name="document-text-outline" size={32} color={color} />
            </View>
            <Text style={[styles.dropZoneLabel, { color }]}>{label}</Text>
            <Text style={styles.dropZoneSublabel}>{sublabel}</Text>
            <View style={[styles.addBtn, { borderColor: color }]}>
              <Ionicons name="add" size={16} color={color} />
              <Text style={[styles.addBtnText, { color }]}>ADD SPECIMEN</Text>
            </View>
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
        <Image source={{ uri: `data:image/jpeg;base64,${item.questioned_thumb}` }} style={styles.historyThumb} />
        <View style={styles.historyArrow}>
          <Ionicons name="swap-horizontal" size={12} color={COLORS.accent} />
        </View>
        <Image source={{ uri: `data:image/jpeg;base64,${item.known_thumb}` }} style={styles.historyThumb} />
      </View>
      <Text style={[styles.historyScore, { color: item.verdict_color }]}>
        {item.composite_score.toFixed(0)}%
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/help')}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/history')}>
            <Ionicons name="folder-outline" size={22} color={COLORS.textDim} />
          </TouchableOpacity>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <Ionicons name="finger-print" size={40} color={COLORS.accent} />
            </View>
          </View>
          <Text style={styles.title}>WRITESLEUTH</Text>
          <Text style={styles.subtitle}>FORENSIC HANDWRITING ANALYSIS SYSTEM</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>SYSTEM READY</Text>
          </View>
        </View>

        {/* Specimen Drop Zones */}
        <View style={styles.specimenSection}>
          <Text style={styles.sectionLabel}>SPECIMEN INPUT</Text>
          <View style={styles.dropZonesContainer}>
            {renderDropZone('questioned')}
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            {renderDropZone('known')}
          </View>
        </View>

        {/* AI Toggle */}
        <TouchableOpacity style={styles.aiToggle} onPress={() => setUseAI(!useAI)}>
          <View style={[styles.checkbox, useAI && styles.checkboxActive]}>
            {useAI && <Ionicons name="checkmark" size={14} color={COLORS.bgDark} />}
          </View>
          <View style={styles.aiToggleContent}>
            <Text style={styles.aiToggleLabel}>GROK VISION AI</Text>
            <Text style={styles.aiToggleDesc}>Deep learning analysis enabled</Text>
          </View>
          <View style={[styles.aiStatus, useAI && styles.aiStatusActive]}>
            <Text style={[styles.aiStatusText, useAI && styles.aiStatusTextActive]}>
              {useAI ? 'ON' : 'OFF'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Analyze Button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!questionedImage || !knownImage) && styles.analyzeBtnDisabled]}
          onPress={handleCompare}
          disabled={isComparing || !questionedImage || !knownImage}
        >
          {isComparing ? (
            <>
              <ActivityIndicator color={COLORS.bgDark} size="small" />
              <Text style={styles.analyzeBtnText}>ANALYZING SPECIMENS...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={22} color={COLORS.bgDark} />
              <Text style={styles.analyzeBtnText}>INITIATE ANALYSIS</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Clear Button */}
        {(questionedImage || knownImage) && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearImages}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={styles.clearBtnText}>CLEAR SPECIMENS</Text>
          </TouchableOpacity>
        )}

        {/* Recent Cases */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={styles.sectionLabel}>RECENT CASES</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.viewAllText}>VIEW ALL</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 8 },
  headerBtn: { 
    padding: 10, 
    backgroundColor: COLORS.bgPanel, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titleSection: { alignItems: 'center', marginBottom: 24 },
  logoContainer: { marginBottom: 12 },
  logoRing: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    borderWidth: 2, 
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPanel,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: COLORS.text, 
    letterSpacing: 4,
  },
  subtitle: { 
    fontSize: 10, 
    color: COLORS.textDim, 
    marginTop: 4, 
    letterSpacing: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.bgPanel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.success + '50',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success, marginRight: 8 },
  statusText: { fontSize: 10, color: COLORS.success, letterSpacing: 1 },
  specimenSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, color: COLORS.textDim, letterSpacing: 2, marginBottom: 12 },
  dropZonesContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropZone: {
    width: '44%',
    aspectRatio: 0.8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: COLORS.bgPanel,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropZoneContent: { alignItems: 'center', padding: 12 },
  dropZoneIcon: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    marginBottom: 8,
  },
  dropZoneLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dropZoneSublabel: { fontSize: 9, color: COLORS.textDim, marginTop: 2, textAlign: 'center' },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 12, 
    paddingHorizontal: 10, 
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  addBtnText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  zoneLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4 },
  zoneLabelText: { fontSize: 9, color: '#fff', fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  vsContainer: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: COLORS.bgCard, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vsText: { fontSize: 10, fontWeight: '700', color: COLORS.textDim },
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.bgPanel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: { backgroundColor: COLORS.accent },
  aiToggleContent: { flex: 1 },
  aiToggleLabel: { fontSize: 12, color: COLORS.text, fontWeight: '600', letterSpacing: 1 },
  aiToggleDesc: { fontSize: 10, color: COLORS.textDim },
  aiStatus: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 4,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiStatusActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  aiStatusText: { fontSize: 10, color: COLORS.textDim, fontWeight: '700' },
  aiStatusTextActive: { color: COLORS.bgDark },
  analyzeBtn: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 10,
  },
  analyzeBtnDisabled: { backgroundColor: COLORS.bgCard, opacity: 0.5 },
  analyzeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.bgDark, letterSpacing: 1 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  clearBtnText: { fontSize: 12, color: COLORS.danger, letterSpacing: 1 },
  historySection: { marginTop: 28 },
  historySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 11, color: COLORS.accent, letterSpacing: 1 },
  historyCard: {
    backgroundColor: COLORS.bgPanel,
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyImages: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  historyThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: COLORS.bgCard },
  historyArrow: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: COLORS.bgCard, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  historyScore: { fontSize: 20, fontWeight: '700', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
