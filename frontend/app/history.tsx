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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, HistoryItem } from '../store/appStore';
import { getHistory, deleteComparison, clearHistory, getComparison } from '../services/api';

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
      'Delete Comparison',
      'Are you sure you want to delete this comparison?',
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
              Alert.alert('Error', 'Failed to delete comparison');
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all comparisons?',
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
              Alert.alert('Error', 'Failed to clear history');
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = async (item: HistoryItem) => {
    try {
      const details = await getComparison(item.id);
      // Convert to the format expected by results screen
      setCurrentResult({
        id: details.id,
        timestamp: details.timestamp,
        questioned_image_thumb: details.questioned_thumb,
        known_image_thumb: details.known_thumb,
        processed_questioned: details.questioned_thumb, // Using thumb as fallback
        processed_known: details.known_thumb,
        difference_heatmap: details.questioned_thumb, // Placeholder
        composite_score: details.composite_score,
        sub_scores: details.sub_scores || [],
        verdict: details.verdict,
        verdict_color: details.verdict_color,
        ai_analysis: details.ai_analysis,
      });
      router.push('/results');
    } catch (e) {
      Alert.alert('Error', 'Failed to load comparison details');
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => handleViewDetails(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.imagesContainer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.questioned_thumb}` }}
            style={styles.thumbnail}
          />
          <View style={styles.arrowContainer}>
            <Ionicons name="swap-horizontal" size={20} color="#64748b" />
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
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {history.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.countText}>{history.length} comparisons</Text>
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={64} color="#334155" />
          <Text style={styles.emptyTitle}>No Comparisons Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your comparison history will appear here
          </Text>
          <TouchableOpacity
            style={styles.newComparisonButton}
            onPress={() => router.back()}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.newComparisonText}>Start New Comparison</Text>
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
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  countText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  clearAllText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
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
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  arrowContainer: {
    paddingHorizontal: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  verdictText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  newComparisonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  newComparisonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
