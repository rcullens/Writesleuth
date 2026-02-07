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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAppStore, SubScore } from '../store/appStore';
import { useOverlayStore } from '../store/overlayStore';
import { generatePDFReport } from '../services/api';

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
          <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
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
    if (!questionedImage || !knownImage) {
      Alert.alert('Missing Images', 'Both images are required for overlay comparison.');
      return;
    }
    resetAll();
    setSourceImage(questionedImage);
    setBaseImage(knownImage);
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
      
      // Write PDF to file
      await FileSystem.writeAsStringAsync(fileUri, pdfResponse.pdf_base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Forensic Report',
          UTI: 'com.adobe.pdf',
        });
      } else if (Platform.OS === 'web') {
        // For web, create a download link
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
    const getScoreColor = (score: number) => {
      if (score >= 85) return '#22c55e';
      if (score >= 70) return '#f59e0b';
      return '#ef4444';
    };

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
        {/* Verdict Section */}
        <View style={[styles.verdictContainer, { borderColor: currentResult.verdict_color }]}>
          <Text style={styles.verdictLabel}>FORENSIC VERDICT</Text>
          <Text style={[styles.compositeScore, { color: currentResult.verdict_color }]}>
            {currentResult.composite_score.toFixed(1)}%
          </Text>
          <Text style={[styles.verdictText, { color: currentResult.verdict_color }]}>
            {currentResult.verdict}
          </Text>
        </View>

        {/* Side by Side Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Original Samples</Text>
          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Questioned (QD)</Text>
              <Image
                source={{ uri: `data:image/jpeg;base64,${currentResult.questioned_image_thumb}` }}
                style={styles.sampleImage}
              />
            </View>
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Known (K)</Text>
              <Image
                source={{ uri: `data:image/jpeg;base64,${currentResult.known_image_thumb}` }}
                style={styles.sampleImage}
              />
            </View>
          </View>
        </View>

        {/* Processed Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Processed / Normalized</Text>
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
          <Text style={styles.sectionTitle}>Difference Heatmap</Text>
          <Text style={styles.heatmapNote}>Red regions indicate higher dissimilarity</Text>
          <Image
            source={{ uri: `data:image/png;base64,${currentResult.difference_heatmap}` }}
            style={styles.heatmapImage}
          />
        </View>

        {/* Sub-Scores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis Breakdown</Text>
          {currentResult.sub_scores.map((score, index) => renderScoreCard(score, index))}
        </View>

        {/* AI Analysis */}
        {currentResult.ai_analysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="sparkles" size={16} color="#3b82f6" /> AI Deep Analysis
            </Text>
            <View style={styles.aiAnalysisCard}>
              <ScrollView style={styles.aiAnalysisScroll} nestedScrollEnabled>
                <Text style={styles.aiAnalysisText}>{currentResult.ai_analysis}</Text>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Crop & Overlay Mode Button - Prominent forensic-blue */}
          <TouchableOpacity
            style={styles.overlayModeButton}
            onPress={handleCropOverlayMode}
          >
            <Ionicons name="layers-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Crop & Overlay Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveReport}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.actionButtonText}>Generating PDF...</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Save Report (PDF)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleNewComparison}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>New Comparison</Text>
          </TouchableOpacity>
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
  verdictContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 24,
  },
  verdictLabel: {
    fontSize: 12,
    color: '#64748b',
    letterSpacing: 2,
    marginBottom: 8,
  },
  compositeScore: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  verdictText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: '48%',
  },
  imageLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    textAlign: 'center',
  },
  sampleImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  processedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  heatmapNote: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  heatmapImage: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  scoreCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  scoreCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    marginBottom: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreCardDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  aiAnalysisCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    maxHeight: 300,
  },
  aiAnalysisScroll: {
    maxHeight: 250,
  },
  aiAnalysisText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
