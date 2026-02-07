import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HelpScreen() {
  const router = useRouter();

  const features = [
    {
      icon: 'document-text',
      title: 'Load Two Samples',
      description: 'Import a questioned document and a known reference sample for comparison.',
    },
    {
      icon: 'analytics',
      title: 'Multi-Algorithm Analysis',
      description: 'Compares samples using macro geometry, stroke patterns, structural similarity, and AI deep analysis.',
    },
    {
      icon: 'color-palette',
      title: 'Visual Comparison',
      description: 'View processed images side-by-side with difference heatmaps highlighting dissimilar regions.',
    },
    {
      icon: 'pie-chart',
      title: 'Detailed Scoring',
      description: 'Get a composite similarity score with explainable sub-scores for transparency.',
    },
    {
      icon: 'sparkles',
      title: 'AI-Powered Analysis',
      description: 'Grok Vision analysis provides expert-level forensic insights.',
    },
    {
      icon: 'time',
      title: 'Comparison History',
      description: 'All comparisons are saved for future reference and review.',
    },
    {
      icon: 'document-text-outline',
      title: 'PDF Reports',
      description: 'Export detailed forensic reports as PDF documents for sharing and archival.',
    },
  ];

  const metrics = [
    { name: 'Macro Geometry', desc: 'Slant angle, letter ratios, line spacing' },
    { name: 'Stroke Distribution', desc: 'Stroke width histogram comparison' },
    { name: 'Curvature Match', desc: 'Stroke curvature statistics' },
    { name: 'Structural Similarity', desc: 'SSIM index between images' },
    { name: 'Correlation', desc: 'Normalized cross-correlation score' },
    { name: 'AI Deep Analysis', desc: 'GPT-4o forensic expert analysis' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="finger-print" size={56} color="#3b82f6" />
          <Text style={styles.title}>Handwriting Forensic Comparator</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon as any} size={24} color="#3b82f6" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Analysis Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis Metrics</Text>
          <View style={styles.metricsContainer}>
            {metrics.map((metric, index) => (
              <View key={index} style={styles.metricItem}>
                <Text style={styles.metricName}>{metric.name}</Text>
                <Text style={styles.metricDesc}>{metric.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Verdict Thresholds */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verdict Thresholds</Text>
          <View style={styles.thresholdsContainer}>
            <View style={styles.thresholdItem}>
              <View style={[styles.thresholdDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.thresholdText}>
                <Text style={styles.thresholdValue}>≥88%</Text> — High probability same writer
              </Text>
            </View>
            <View style={styles.thresholdItem}>
              <View style={[styles.thresholdDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.thresholdText}>
                <Text style={styles.thresholdValue}>70-88%</Text> — Possible / Inconclusive
              </Text>
            </View>
            <View style={styles.thresholdItem}>
              <View style={[styles.thresholdDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.thresholdText}>
                <Text style={styles.thresholdValue}>{'<'}70%</Text> — Likely different writers
              </Text>
            </View>
          </View>
        </View>

        {/* How to Use */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Use</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Tap on "Questioned Document" zone to add the sample you want to verify</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Tap on "Known Sample" zone to add a reference sample from a known writer</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Toggle AI Analysis on/off based on your preference</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Tap "Compare Handwriting" to run the analysis</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>5</Text>
              </View>
              <Text style={styles.stepText}>Review results with scores, heatmaps, and verdict</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>6</Text>
              </View>
              <Text style={styles.stepText}>Save and share your report as a PDF document</Text>
            </View>
          </View>
        </View>

        {/* Got It Button */}
        <TouchableOpacity style={styles.gotItButton} onPress={() => router.back()}>
          <Text style={styles.gotItButtonText}>Got It</Text>
        </TouchableOpacity>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 12,
    textAlign: 'center',
  },
  version: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 10,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  featureDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  metricsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  metricItem: {
    marginBottom: 12,
  },
  metricName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  metricDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  thresholdsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  thresholdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  thresholdDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  thresholdText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  thresholdValue: {
    fontWeight: '600',
    color: '#f8fafc',
  },
  stepsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  gotItButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  gotItButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
