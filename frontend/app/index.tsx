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
import { STEAMPUNK_COLORS as C } from '../styles/theme';

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
    const color = type === 'questioned' ? C.copper : C.teal;

    return (
      <TouchableOpacity
        style={[styles.dropZone, { borderColor: color }]}
        onPress={() => showImageOptions(type)}
        activeOpacity={0.7}
        data-testid={`${type}-drop-zone`}
      >
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: color }]}
              onPress={() => type === 'questioned' ? setQuestionedImage(null) : setKnownImage(null)}
              data-testid={`${type}-remove-btn`}
            >
              <Ionicons name="close" size={16} color={C.bgDark} />
            </TouchableOpacity>
            <View style={[styles.zoneLabel, { backgroundColor: color }]}>
              <Text style={styles.zoneLabelText}>{label}</Text>
            </View>
          </>
        ) : (
          <View style={styles.dropZoneContent}>
            <View style={[styles.dropZoneIcon, { borderColor: color }]}>
              <Ionicons name="document-text-outline" size={28} color={color} />
            </View>
            <Text style={[styles.dropZoneLabel, { color }]}>{label}</Text>
            <Text style={styles.dropZoneSublabel}>{sublabel}</Text>
            <View style={[styles.addBtn, { borderColor: color }]}>
              <Ionicons name="add" size={14} color={color} />
              <Text style={[styles.addBtnText, { color }]}>ADD SPECIMEN</Text>
            </View>
          </View>
        )}
        {/* Decorative corner rivets */}
        <View style={[styles.rivet, styles.rivetTL]} />
        <View style={[styles.rivet, styles.rivetTR]} />
        <View style={[styles.rivet, styles.rivetBL]} />
        <View style={[styles.rivet, styles.rivetBR]} />
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = (item: HistoryItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.historyCard}
      onPress={() => router.push({ pathname: '/history', params: { id: item.id } })}
      data-testid={`history-item-${item.id}`}
    >
      <View style={styles.historyImages}>
        <Image source={{ uri: `data:image/jpeg;base64,${item.questioned_thumb}` }} style={styles.historyThumb} />
        <View style={styles.historyArrow}>
          <Ionicons name="swap-horizontal" size={12} color={C.brass} />
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
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/help')} data-testid="help-btn">
            <Ionicons name="information-circle-outline" size={22} color={C.brass} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/history')} data-testid="history-btn">
            <Ionicons name="folder-outline" size={22} color={C.brass} />
          </TouchableOpacity>
        </View>

        {/* Title Section - Steampunk Style */}
        <View style={styles.titleSection}>
          <View style={styles.logoContainer}>
            <View style={styles.gearRing}>
              <View style={styles.innerRing}>
                <Ionicons name="finger-print" size={36} color={C.brass} />
              </View>
            </View>
            {/* Decorative gears */}
            <View style={[styles.decorativeGear, styles.gearTopRight]}>
              <Ionicons name="cog" size={20} color={C.brassDark} />
            </View>
            <View style={[styles.decorativeGear, styles.gearBottomLeft]}>
              <Ionicons name="cog" size={16} color={C.brassDark} />
            </View>
          </View>
          <Text style={styles.title}>WRITESLEUTH</Text>
          <Text style={styles.subtitle}>FORENSIC HANDWRITING ANALYSIS APPARATUS</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>APPARATUS READY</Text>
          </View>
        </View>

        {/* Specimen Drop Zones */}
        <View style={styles.specimenSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cog-outline" size={14} color={C.brass} />
            <Text style={styles.sectionLabel}>SPECIMEN INPUT</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.dropZonesContainer}>
            {renderDropZone('questioned')}
            <View style={styles.vsContainer}>
              <View style={styles.vsOuter}>
                <Text style={styles.vsText}>VS</Text>
              </View>
            </View>
            {renderDropZone('known')}
          </View>
        </View>

        {/* AI Toggle - Steampunk Switch */}
        <TouchableOpacity style={styles.aiToggle} onPress={() => setUseAI(!useAI)} data-testid="ai-toggle">
          <View style={[styles.toggleSwitch, useAI && styles.toggleSwitchActive]}>
            <View style={[styles.toggleKnob, useAI && styles.toggleKnobActive]} />
          </View>
          <View style={styles.aiToggleContent}>
            <Text style={styles.aiToggleLabel}>GROK VISION ENGINE</Text>
            <Text style={styles.aiToggleDesc}>Deep learning analysis module</Text>
          </View>
          <View style={[styles.aiStatus, useAI && styles.aiStatusActive]}>
            <Ionicons name={useAI ? 'flash' : 'flash-off'} size={14} color={useAI ? C.bgDark : C.textDim} />
            <Text style={[styles.aiStatusText, useAI && styles.aiStatusTextActive]}>
              {useAI ? 'ENGAGED' : 'STANDBY'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Analyze Button - Brass Lever Style */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!questionedImage || !knownImage) && styles.analyzeBtnDisabled]}
          onPress={handleCompare}
          disabled={isComparing || !questionedImage || !knownImage}
          data-testid="analyze-btn"
        >
          {isComparing ? (
            <>
              <ActivityIndicator color={C.bgDark} size="small" />
              <Text style={styles.analyzeBtnText}>ANALYZING SPECIMENS...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={22} color={C.bgDark} />
              <Text style={styles.analyzeBtnText}>INITIATE ANALYSIS</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Clear Button */}
        {(questionedImage || knownImage) && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearImages} data-testid="clear-btn">
            <Ionicons name="trash-outline" size={16} color={C.danger} />
            <Text style={styles.clearBtnText}>CLEAR SPECIMENS</Text>
          </TouchableOpacity>
        )}

        {/* Recent Cases */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <View style={styles.sectionHeader}>
                <Ionicons name="file-tray-stacked-outline" size={14} color={C.brass} />
                <Text style={styles.sectionLabel}>RECENT CASE FILES</Text>
                <View style={styles.sectionLine} />
              </View>
              <TouchableOpacity onPress={() => router.push('/history')} data-testid="view-all-btn">
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
  container: { flex: 1, backgroundColor: C.bgDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 8 },
  headerBtn: { 
    padding: 10, 
    backgroundColor: C.bgPanel, 
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  
  // Title Section
  titleSection: { alignItems: 'center', marginBottom: 28, position: 'relative' },
  logoContainer: { marginBottom: 12, position: 'relative' },
  gearRing: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 3, 
    borderColor: C.brass,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bgPanel,
  },
  innerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: C.brassDark,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bgCard,
  },
  decorativeGear: { position: 'absolute' },
  gearTopRight: { top: -5, right: -10 },
  gearBottomLeft: { bottom: 0, left: -8 },
  title: { 
    fontSize: 26, 
    fontWeight: '700', 
    color: C.brass, 
    letterSpacing: 6,
  },
  subtitle: { 
    fontSize: 9, 
    color: C.textDim, 
    marginTop: 6, 
    letterSpacing: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.bgPanel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.success + '60',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success, marginRight: 10 },
  statusText: { fontSize: 10, color: C.success, letterSpacing: 2, fontWeight: '600' },

  // Section Headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionLabel: { fontSize: 10, color: C.brass, letterSpacing: 2, fontWeight: '600' },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border, marginLeft: 8 },

  // Specimen Section
  specimenSection: { marginBottom: 20 },
  dropZonesContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropZone: {
    width: '44%',
    aspectRatio: 0.8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: C.bgPanel,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dropZoneContent: { alignItems: 'center', padding: 10 },
  dropZoneIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: C.bgCard,
    marginBottom: 8,
  },
  dropZoneLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dropZoneSublabel: { fontSize: 8, color: C.textDim, marginTop: 2, textAlign: 'center' },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 10, 
    paddingHorizontal: 10, 
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  addBtnText: { fontSize: 8, fontWeight: '600', letterSpacing: 1 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  zoneLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4 },
  zoneLabelText: { fontSize: 9, color: C.bgDark, fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  
  // Rivet decorations
  rivet: { 
    position: 'absolute', 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: C.rivet,
    borderWidth: 1,
    borderColor: C.brassDark,
  },
  rivetTL: { top: 4, left: 4 },
  rivetTR: { top: 4, right: 4 },
  rivetBL: { bottom: 4, left: 4 },
  rivetBR: { bottom: 4, right: 4 },

  vsContainer: { justifyContent: 'center', alignItems: 'center' },
  vsOuter: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: C.bgCard, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.brass,
  },
  vsText: { fontSize: 10, fontWeight: '700', color: C.brass },

  // AI Toggle - Steampunk style
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: C.bgPanel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  toggleSwitch: {
    width: 46,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: C.border,
    padding: 2,
    marginRight: 12,
  },
  toggleSwitchActive: {
    backgroundColor: C.brass + '30',
    borderColor: C.brass,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.textDim,
  },
  toggleKnobActive: {
    backgroundColor: C.brass,
    transform: [{ translateX: 22 }],
  },
  aiToggleContent: { flex: 1 },
  aiToggleLabel: { fontSize: 11, color: C.text, fontWeight: '600', letterSpacing: 1 },
  aiToggleDesc: { fontSize: 9, color: C.textDim },
  aiStatus: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 4,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiStatusActive: { backgroundColor: C.brass, borderColor: C.brassLight },
  aiStatusText: { fontSize: 9, color: C.textDim, fontWeight: '700', letterSpacing: 1 },
  aiStatusTextActive: { color: C.bgDark },

  // Analyze Button - Brass lever
  analyzeBtn: {
    backgroundColor: C.brass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 10,
    borderWidth: 2,
    borderColor: C.brassLight,
    shadowColor: C.brass,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  analyzeBtnDisabled: { backgroundColor: C.bgCard, borderColor: C.border, opacity: 0.6 },
  analyzeBtnText: { fontSize: 14, fontWeight: '700', color: C.bgDark, letterSpacing: 2 },
  
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  clearBtnText: { fontSize: 11, color: C.danger, letterSpacing: 1, fontWeight: '600' },

  // History Section
  historySection: { marginTop: 28 },
  historySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 10, color: C.brass, letterSpacing: 1, fontWeight: '600' },
  historyCard: {
    backgroundColor: C.bgPanel,
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyImages: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  historyThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: C.bgCard },
  historyArrow: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: C.bgCard, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  historyScore: { 
    fontSize: 20, 
    fontWeight: '700', 
    textAlign: 'center', 
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
