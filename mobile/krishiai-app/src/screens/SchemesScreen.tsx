/**
 * SchemesScreen
 * Government schemes discovery and filtering
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {database} from '../database';
import CachedScheme from '../database/models/CachedScheme';
import {Q} from '@nozbe/watermelondb';

interface SchemeCardProps {
  scheme: CachedScheme;
  onPress: () => void;
  language: string;
}

const SchemeCard: React.FC<SchemeCardProps> = ({scheme, onPress, language}) => {
  const {t} = useTranslation();

  const getSchemeName = () => {
    if (language === 'hi') return scheme.schemeNameHi;
    if (language === 'mr') return scheme.schemeNameMr;
    return scheme.schemeName;
  };

  const getEligibilityIndicator = () => {
    if (scheme.isEligible) {
      return {icon: 'check-circle', color: '#4CAF50', label: t('schemes.eligibleSchemes')};
    }
    return {icon: 'cancel', color: '#9E9E9E', label: t('schemes.allSchemes')};
  };

  const getDaysLeft = () => {
    const now = new Date();
    const deadline = new Date(scheme.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const eligibility = getEligibilityIndicator();
  const daysLeft = getDaysLeft();

  return (
    <TouchableOpacity style={styles.schemeCard} onPress={onPress}>
      <View style={styles.schemeHeader}>
        <View style={styles.schemeNameContainer}>
          <Text style={styles.schemeName} numberOfLines={2}>
            {getSchemeName()}
          </Text>
          <View style={[styles.categoryBadge, {backgroundColor: '#2196F3'}]}>
            <Text style={styles.categoryText}>{scheme.schemeType}</Text>
          </View>
        </View>
        <Icon name={eligibility.icon} size={24} color={eligibility.color} />
      </View>

      <View style={styles.schemeDetails}>
        <View style={styles.detailRow}>
          <Icon name="account-balance-wallet" size={16} color="#666" />
          <Text style={styles.detailText}>
            {t('schemes.benefits')}: ₹{scheme.benefitsAmount.toLocaleString()}
          </Text>
        </View>

        {daysLeft > 0 && daysLeft <= 30 && (
          <View style={[styles.detailRow, styles.deadlineRow]}>
            <Icon name="schedule" size={16} color="#FF9800" />
            <Text style={[styles.detailText, {color: '#FF9800'}]}>
              {t('schemes.daysLeft', {days: daysLeft})}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.viewDetailsButton} onPress={onPress}>
        <Text style={styles.viewDetailsText}>{t('schemes.viewDetails')}</Text>
        <Icon name="arrow-forward" size={16} color="#2196F3" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function SchemesScreen() {
  const {t, i18n} = useTranslation();
  const navigation = useNavigation();
  const [schemes, setSchemes] = useState<CachedScheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<CachedScheme[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'eligible'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSchemes();
  }, []);

  useEffect(() => {
    filterSchemes();
  }, [schemes, searchQuery, selectedFilter]);

  const loadSchemes = async () => {
    try {
      const schemesCollection = database.collections.get<CachedScheme>('cached_schemes');
      const allSchemes = await schemesCollection.query().fetch();
      setSchemes(allSchemes);
    } catch (error) {
      console.error('Failed to load schemes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterSchemes = () => {
    let filtered = schemes;

    // Filter by eligibility
    if (selectedFilter === 'eligible') {
      filtered = filtered.filter(s => s.isEligible);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const name = i18n.language === 'hi' 
          ? s.schemeNameHi 
          : i18n.language === 'mr' 
          ? s.schemeNameMr 
          : s.schemeName;
        return name.toLowerCase().includes(query) || 
               s.schemeType.toLowerCase().includes(query);
      });
    }

    setFilteredSchemes(filtered);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSchemes();
  };

  const handleSchemePress = (scheme: CachedScheme) => {
    navigation.navigate('SchemeDetail' as never, {scheme} as never);
  };

  const renderScheme = ({item}: {item: CachedScheme}) => (
    <SchemeCard
      scheme={item}
      onPress={() => handleSchemePress(item)}
      language={i18n.language}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('schemes.searchSchemes')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'all' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('all')}>
          <Text
            style={[
              styles.filterButtonText,
              selectedFilter === 'all' && styles.filterButtonTextActive,
            ]}>
            {t('schemes.allSchemes')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'eligible' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('eligible')}>
          <Icon
            name="check-circle"
            size={16}
            color={selectedFilter === 'eligible' ? '#fff' : '#4CAF50'}
            style={{marginRight: 4}}
          />
          <Text
            style={[
              styles.filterButtonText,
              selectedFilter === 'eligible' && styles.filterButtonTextActive,
            ]}>
            {t('schemes.eligibleSchemes')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="description" size={64} color="#ccc" />
      <Text style={styles.emptyText}>
        {searchQuery ? t('common.noResults') : t('schemes.noSchemes')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredSchemes}
        renderItem={renderScheme}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  schemeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  schemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  schemeNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  schemeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  schemeDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deadlineRow: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
