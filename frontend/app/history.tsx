import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, HistoryItem } from '../store/appStore';
import { getHistory, deleteComparison, clearHistory, getComparison } from '../services/api';
import { STEAMPUNK_COLORS as C } from '../styles/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const { history, setHistory, setCurrentResult } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getHistory(50);
      setHistory(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleDelete = (item: HistoryItem) => {
    Alert.alert(
      'Delete Case File',
      'Are you sure you want to delete this case file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComparison(item.id);
              loadHistory();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete case file');
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Case Files',
      'Are you sure you want to delete all case files?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistory();
              loadHistory();
            } catch (e) {
              Alert.alert('Error', 'Failed to clear case files');
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = async (item: HistoryItem) => {
    try {
      const details = await getComparison(item.id);
      setCurrentResult({
        id: details.id,
        timestamp: details.timestamp,
        questioned_image_thumb: details.questioned_thumb,
        known_image_thumb: details.known_thumb,
        processed_questioned: details.questioned_thumb,
        processed_known: details.known_thumb,
        difference_heatmap: details.questioned_thumb,
        composite_score: details.composite_score,
        sub_scores: details.sub_scores || [],
        verdict: details.verdict,
        verdict_color: details.verdict_color,
        ai_analysis: details.ai_analysis,
      });
      router.push('/results');
    } catch (e) {
      Alert.alert('Error', 'Failed to load case file details');
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => handleViewDetails(item)}
      activeOpacity={0.7}
      data-testid={`history-card-${item.id}`}
    >
      <View style={styles.cardContent}>
        <View style={styles.imagesContainer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.questioned_thumb}` }}
            style={styles.thumbnail}
          />
          <View style={styles.arrowContainer}>
            <Ionicons name="swap-horizontal" size={18} color={C.brass} />
          </View>
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.known_thumb}` }}
            style={styles.thumbnail}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={[styles.scoreText, { color: item.verdict_color }]}>
            {item.composite_score.toFixed(1)}%
          </Text>
          <Text style={[styles.verdictText, { color: item.verdict_color }]}>
            {item.verdict}
          </Text>
          <Text style={styles.dateText}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          data-testid={`delete-${item.id}-btn`}
        >
          <Ionicons name="trash-outline" size={18} color={C.danger} />
        </TouchableOpacity>
      </View>
      {/* Decorative rivets */}
      <View style={[styles.rivet, styles.rivetTL]} />
      <View style={[styles.rivet, styles.rivetTR]} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.brass} />
          <Text style={styles.loadingText}>Loading case files...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {history.length > 0 && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="file-tray-stacked-outline" size={16} color={C.brass} />
            <Text style={styles.countText}>{history.length} case files</Text>
          </View>
          <TouchableOpacity onPress={handleClearAll} data-testid="clear-all-btn">
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="file-tray-outline" size={56} color={C.brass} />
          </View>
          <Text style={styles.emptyTitle}>No Case Files</Text>
          <Text style={styles.emptySubtitle}>
            Your analysis history will appear here
          </Text>
          <TouchableOpacity
            style={styles.newComparisonButton}
            onPress={() => router.back()}
            data-testid="start-new-btn"
          >
            <Ionicons name="add-circle-outline" size={20} color={C.bgDark} />
            <Text style={styles.newComparisonText}>Start New Analysis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: C.textDim,
    fontSize: 13,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgPanel,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countText: {
    color: C.text,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  clearAllText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  listContent: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: C.bgPanel,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  imagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  arrowContainer: {
    paddingHorizontal: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 10,
    color: C.textDim,
    marginTop: 4,
  },
  deleteButton: {
    padding: 10,
    backgroundColor: C.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.danger + '30',
  },
  rivet: { 
    position: 'absolute', 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: C.rivet,
    borderWidth: 1,
    borderColor: C.brassDark,
  },
  rivetTL: { top: 6, left: 6 },
  rivetTR: { top: 6, right: 6 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.bgPanel,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.brass,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
    letterSpacing: 1,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.textDim,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  newComparisonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brass,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
    borderWidth: 2,
    borderColor: C.brassLight,
  },
  newComparisonText: {
    color: C.bgDark,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
