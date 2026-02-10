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
import { STEAMPUNK_COLORS as C } from '../styles/theme';

export default function HelpScreen() {
  const router = useRouter();

  const features = [
    {
      icon: 'document-text',
      title: 'Load Two Specimens',
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
    { name: 'AI Deep Analysis', desc: 'Grok Vision forensic expert analysis' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <Ionicons name="finger-print" size={48} color={C.brass} />
            </View>
            <View style={[styles.decorativeGear, styles.gearTopRight]}>
              <Ionicons name="cog" size={18} color={C.brassDark} />
            </View>
          </View>
          <Text style={styles.title}>WRITESLEUTH</Text>
          <Text style={styles.subtitle}>Handwriting Forensic Analysis Apparatus</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.version}>Version 1.0.0</Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cog-outline" size={14} color={C.brass} />
            <Text style={styles.sectionTitle}>APPARATUS FEATURES</Text>
            <View style={styles.sectionLine} />
          </View>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon as any} size={22} color={C.brass} />
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
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart-outline" size={14} color={C.brass} />
            <Text style={styles.sectionTitle}>ANALYSIS METRICS</Text>
            <View style={styles.sectionLine} />
          </View>
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
          <View style={styles.sectionHeader}>
            <Ionicons name="speedometer-outline" size={14} color={C.brass} />
            <Text style={styles.sectionTitle}>MATCH PROBABILITY</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.thresholdsContainer}>
            <View style={styles.thresholdItem}>
              <View style={[styles.thresholdDot, { backgroundColor: C.success }]} />
              <Text style={styles.thresholdText}>
                <Text style={styles.thresholdValue}>≥50%</Text> — Match Likely (Green)
              </Text>
            </View>
            <View style={styles.thresholdItem}>
              <View style={[styles.thresholdDot, { backgroundColor: C.danger }]} />
              <Text style={styles.thresholdText}>
                <Text style={styles.thresholdValue}>{'<'}50%</Text> — Match Unlikely (Red)
              </Text>
            </View>
          </View>
        </View>

        {/* How to Use */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={14} color={C.brass} />
            <Text style={styles.sectionTitle}>OPERATING INSTRUCTIONS</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Tap on "Questioned" zone to add the specimen you want to verify</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Tap on "Known" zone to add a reference sample from a known writer</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Toggle the GROK Vision Engine on/off based on your preference</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Tap "INITIATE ANALYSIS" to run the forensic comparison</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>5</Text>
              </View>
              <Text style={styles.stepText}>Review results with scores, heatmaps, and verdict assessment</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>6</Text>
              </View>
              <Text style={styles.stepText}>Save and share your forensic report as a PDF document</Text>
            </View>
          </View>
        </View>

        {/* Got It Button */}
        <TouchableOpacity style={styles.gotItButton} onPress={() => router.back()} data-testid="got-it-btn">
          <Text style={styles.gotItButtonText}>UNDERSTOOD</Text>
        </TouchableOpacity>
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
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: C.brass,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bgPanel,
  },
  decorativeGear: {
    position: 'absolute',
  },
  gearTopRight: {
    top: -4,
    right: -8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: C.brass,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 4,
    letterSpacing: 2,
    textAlign: 'center',
  },
  versionBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: C.bgPanel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  version: {
    fontSize: 10,
    color: C.textDim,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: C.brass,
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
    marginLeft: 8,
  },
  featureCard: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 0.5,
  },
  featureDesc: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 4,
    lineHeight: 16,
  },
  metricsContainer: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  metricItem: {
    marginBottom: 12,
  },
  metricName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.brass,
    letterSpacing: 0.5,
  },
  metricDesc: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 2,
  },
  thresholdsContainer: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
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
    fontSize: 12,
    color: C.textDim,
  },
  thresholdValue: {
    fontWeight: '600',
    color: C.text,
  },
  stepsContainer: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.brass,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.bgDark,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: C.textDim,
    lineHeight: 18,
  },
  gotItButton: {
    backgroundColor: C.brass,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: C.brassLight,
  },
  gotItButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.bgDark,
    letterSpacing: 2,
  },
});
