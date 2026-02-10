import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAppStore, SubScore } from '../store/appStore';
import { useOverlayStore } from '../store/overlayStore';
import { generatePDFReport } from '../services/api';
import { STEAMPUNK_COLORS as C } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function ResultsScreen() {
  const router = useRouter();
  const { currentResult, clearImages, questionedImage, knownImage } = useAppStore();
  const { setSourceImage, setBaseImage, toggleCropMode, resetAll } = useOverlayStore();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  if (!currentResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={C.textDim} />
          <Text style={styles.emptyText}>No results available</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleNewComparison = () => {
    clearImages();
    router.back();
  };

  const handleCropOverlayMode = () => {
    let sourceImg = questionedImage;
    let baseImg = knownImage;
    
    if (!sourceImg && currentResult?.questioned_image_thumb) {
      sourceImg = `data:image/jpeg;base64,${currentResult.questioned_image_thumb}`;
    }
    if (!baseImg && currentResult?.known_image_thumb) {
      baseImg = `data:image/jpeg;base64,${currentResult.known_image_thumb}`;
    }
    
    if (!sourceImg || !baseImg) {
      Alert.alert('Missing Images', 'Images are not available for overlay comparison. Please run a new comparison first.');
      return;
    }
    
    console.log('Starting crop mode with images:', {
      sourceAvailable: !!sourceImg,
      baseAvailable: !!baseImg,
    });
    
    resetAll();
    setSourceImage(sourceImg);
    setBaseImage(baseImg);
    toggleCropMode(true);
    router.push('/crop');
  };

  const handleSaveReport = async () => {
    if (!currentResult) return;

    setGeneratingPDF(true);
    try {
      const pdfResponse = await generatePDFReport({
        comparison_id: currentResult.id,
        questioned_thumb: currentResult.questioned_image_thumb,
        known_thumb: currentResult.known_image_thumb,
        processed_questioned: currentResult.processed_questioned,
        processed_known: currentResult.processed_known,
        difference_heatmap: currentResult.difference_heatmap,
        composite_score: currentResult.composite_score,
        sub_scores: currentResult.sub_scores.map(s => ({
          name: s.name,
          score: s.score,
          description: s.description,
        })),
        verdict: currentResult.verdict,
        ai_analysis: currentResult.ai_analysis,
      });

      const filename = pdfResponse.filename;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, pdfResponse.pdf_base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Forensic Report',
          UTI: 'com.adobe.pdf',
        });
      } else if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${pdfResponse.pdf_base64}`;
        link.download = filename;
        link.click();
        Alert.alert('Success', 'PDF report downloaded successfully!');
      } else {
        Alert.alert('Success', `Report saved to: ${fileUri}`);
      }
    } catch (error: any) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const renderScoreCard = (subScore: SubScore, index: number) => {
    const getScoreColor = (score: number) => score >= 50 ? C.success : C.danger;

    return (
      <View key={index} style={styles.scoreCard}>
        <View style={styles.scoreCardHeader}>
          <Text style={styles.scoreCardName}>{subScore.name}</Text>
          <Text style={[styles.scoreCardValue, { color: getScoreColor(subScore.score) }]}>
            {subScore.score.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.scoreBar}>
          <View
            style={[
              styles.scoreBarFill,
              {
                width: `${subScore.score}%`,
                backgroundColor: getScoreColor(subScore.score),
              },
            ]}
          />
        </View>
        <Text style={styles.scoreCardDesc}>{subScore.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Match Probability Section */}
        <View style={[styles.verdictContainer, { borderColor: currentResult.verdict_color }]}>
          <View style={styles.verdictHeader}>
            <Ionicons name="analytics" size={20} color={C.brass} />
            <Text style={styles.verdictLabel}>MATCH PROBABILITY</Text>
          </View>
          <Text style={[styles.compositeScore, { color: currentResult.verdict_color }]}>
            {currentResult.composite_score.toFixed(1)}%
          </Text>
          <Text style={[styles.verdictText, { color: currentResult.verdict_color }]}>
            {currentResult.verdict}
          </Text>
          {/* Decorative rivets */}
          <View style={[styles.rivet, styles.rivetTL]} />
          <View style={[styles.rivet, styles.rivetTR]} />
          <View style={[styles.rivet, styles.rivetBL]} />
          <View style={[styles.rivet, styles.rivetBR]} />
        </View>

        {/* Side by Side Comparison */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images-outline" size={16} color={C.brass} />
            <Text style={styles.sectionTitle}>Original Specimens</Text>
          </View>
          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>QUESTIONED (QD)</Text>
              <Image
                source={{ uri: `data:image/jpeg;base64,${currentResult.questioned_image_thumb}` }}
                style={styles.sampleImage}
              />
            </View>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>KNOWN (K)</Text>
              <Image
                source={{ uri: `data:image/jpeg;base64,${currentResult.known_image_thumb}` }}
                style={styles.sampleImage}
              />
            </View>
          </View>
        </View>

        {/* Processed Images */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={16} color={C.brass} />
            <Text style={styles.sectionTitle}>Processed / Normalized</Text>
          </View>
          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${currentResult.processed_questioned}` }}
                style={styles.processedImage}
              />
            </View>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${currentResult.processed_known}` }}
                style={styles.processedImage}
              />
            </View>
          </View>
        </View>

        {/* Difference Heatmap */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="thermometer-outline" size={16} color={C.brass} />
            <Text style={styles.sectionTitle}>Difference Heatmap</Text>
          </View>
          <Text style={styles.heatmapNote}>Red regions indicate higher dissimilarity</Text>
          <Image
            source={{ uri: `data:image/png;base64,${currentResult.difference_heatmap}` }}
            style={styles.heatmapImage}
          />
        </View>

        {/* Sub-Scores */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart-outline" size={16} color={C.brass} />
            <Text style={styles.sectionTitle}>Analysis Breakdown</Text>
          </View>
          {currentResult.sub_scores.map((score, index) => renderScoreCard(score, index))}
        </View>

        {/* AI Analysis */}
        {currentResult.ai_analysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={16} color={C.brass} />
              <Text style={styles.sectionTitle}>GROK Vision Analysis</Text>
            </View>
            <View style={styles.aiAnalysisCard}>
              <ScrollView style={styles.aiAnalysisScroll} nestedScrollEnabled>
                <Text style={styles.aiAnalysisText}>{currentResult.ai_analysis}</Text>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.overlayModeButton}
            onPress={handleCropOverlayMode}
            data-testid="crop-overlay-mode-btn"
          >
            <Ionicons name="layers-outline" size={20} color={C.bgDark} />
            <Text style={styles.primaryActionText}>Crop & Overlay Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveReport}
            disabled={generatingPDF}
            data-testid="save-report-btn"
          >
            {generatingPDF ? (
              <>
                <ActivityIndicator size="small" color={C.bgDark} />
                <Text style={styles.secondaryActionText}>Generating PDF...</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color={C.bgDark} />
                <Text style={styles.secondaryActionText}>Save Report (PDF)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleNewComparison} data-testid="new-comparison-btn">
            <Ionicons name="add-circle-outline" size={20} color={C.brass} />
            <Text style={styles.tertiaryActionText}>New Comparison</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  verdictContainer: {
    backgroundColor: C.bgPanel,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 24,
    position: 'relative',
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verdictLabel: {
    fontSize: 11,
    color: C.brass,
    letterSpacing: 2,
    fontWeight: '600',
  },
  compositeScore: {
    fontSize: 56,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  verdictText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  rivet: { 
    position: 'absolute', 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: C.rivet,
    borderWidth: 1,
    borderColor: C.brassDark,
  },
  rivetTL: { top: 8, left: 8 },
  rivetTR: { top: 8, right: 8 },
  rivetBL: { bottom: 8, left: 8 },
  rivetBR: { bottom: 8, right: 8 },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 1,
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: '48%',
  },
  imageLabel: {
    fontSize: 10,
    color: C.brass,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '600',
  },
  sampleImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: C.bgPanel,
    borderWidth: 1,
    borderColor: C.border,
  },
  processedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: C.border,
  },
  heatmapNote: {
    fontSize: 11,
    color: C.textDim,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  heatmapImage: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 8,
    backgroundColor: C.bgPanel,
    borderWidth: 1,
    borderColor: C.border,
  },
  scoreCard: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 0.5,
  },
  scoreCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scoreBar: {
    height: 6,
    backgroundColor: C.bgCard,
    borderRadius: 3,
    marginBottom: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreCardDesc: {
    fontSize: 11,
    color: C.textDim,
    lineHeight: 16,
  },
  aiAnalysisCard: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 16,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiAnalysisScroll: {
    maxHeight: 250,
  },
  aiAnalysisText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  overlayModeButton: {
    backgroundColor: C.brass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 8,
    borderWidth: 2,
    borderColor: C.brassLight,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.bgDark,
    letterSpacing: 1,
  },
  saveButton: {
    backgroundColor: C.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  secondaryActionText: {
    color: C.bgDark,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  actionButton: {
    backgroundColor: C.bgPanel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: C.brass,
  },
  tertiaryActionText: {
    color: C.brass,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
