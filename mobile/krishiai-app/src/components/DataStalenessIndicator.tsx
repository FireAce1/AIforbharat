import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

export interface StalenessInfo {
  isStale: boolean;
  lastUpdated: Date;
  staleness: 'fresh' | 'recent' | 'stale' | 'very_stale';
  ageMinutes: number;
}

interface DataStalenessIndicatorProps {
  staleness?: StalenessInfo;
  source: 'live' | 'cache';
  compact?: boolean;
}

/**
 * Component to display data staleness indicators
 * Shows when data is from cache and how old it is
 */
export const DataStalenessIndicator: React.FC<
  DataStalenessIndicatorProps
> = ({ staleness, source, compact = false }) => {
  const { t } = useTranslation();

  // Don't show anything for live data
  if (source === 'live' || !staleness) {
    return null;
  }

  const getIndicatorColor = (): string => {
    switch (staleness.staleness) {
      case 'fresh':
        return '#4CAF50'; // Green
      case 'recent':
        return '#8BC34A'; // Light green
      case 'stale':
        return '#FF9800'; // Orange
      case 'very_stale':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Gray
    }
  };

  const getIconName = (): string => {
    switch (staleness.staleness) {
      case 'fresh':
      case 'recent':
        return 'check-circle';
      case 'stale':
        return 'warning';
      case 'very_stale':
        return 'error';
      default:
        return 'info';
    }
  };

  const formatLastUpdated = (): string => {
    const { ageMinutes } = staleness;

    if (ageMinutes < 60) {
      return t('staleness.minutes_ago', { count: ageMinutes });
    } else if (ageMinutes < 1440) {
      // Less than 24 hours
      const hours = Math.floor(ageMinutes / 60);
      return t('staleness.hours_ago', { count: hours });
    } else {
      const days = Math.floor(ageMinutes / 1440);
      return t('staleness.days_ago', { count: days });
    }
  };

  const getStalenessMessage = (): string => {
    switch (staleness.staleness) {
      case 'fresh':
        return t('staleness.fresh');
      case 'recent':
        return t('staleness.recent');
      case 'stale':
        return t('staleness.stale');
      case 'very_stale':
        return t('staleness.very_stale');
      default:
        return t('staleness.cached');
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Icon
          name={getIconName()}
          size={16}
          color={getIndicatorColor()}
          style={styles.compactIcon}
        />
        <Text style={[styles.compactText, { color: getIndicatorColor() }]}>
          {formatLastUpdated()}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderLeftColor: getIndicatorColor() }]}>
      <View style={styles.header}>
        <Icon
          name={getIconName()}
          size={20}
          color={getIndicatorColor()}
          style={styles.icon}
        />
        <Text style={[styles.title, { color: getIndicatorColor() }]}>
          {getStalenessMessage()}
        </Text>
      </View>
      <Text style={styles.subtitle}>
        {t('staleness.last_updated')}: {formatLastUpdated()}
      </Text>
      <Text style={styles.description}>
        {t('staleness.offline_mode_description')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  description: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  compactIcon: {
    marginRight: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DataStalenessIndicator;
