/**
 * SchemeDetailScreen
 * Detailed view of a government scheme
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CachedScheme from '../database/models/CachedScheme';

type RouteParams = {
  SchemeDetail: {
    scheme: CachedScheme;
  };
};

export default function SchemeDetailScreen() {
  const {t, i18n} = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'SchemeDetail'>>();
  const {scheme} = route.params;

  const getSchemeName = () => {
    if (i18n.language === 'hi') return scheme.schemeNameHi;
    if (i18n.language === 'mr') return scheme.schemeNameMr;
    return scheme.schemeName;
  };

  const getDescription = () => {
    if (i18n.language === 'hi') return scheme.description.hi || scheme.description.en;
    if (i18n.language === 'mr') return scheme.description.mr || scheme.description.en;
    return scheme.description.en;
  };

  const getBenefitsDescription = () => {
    if (i18n.language === 'hi') return scheme.benefitsDescriptionHi;
    if (i18n.language === 'mr') return scheme.benefitsDescriptionMr;
    return scheme.benefitsDescription;
  };

  const getDaysLeft = () => {
    const now = new Date();
    const deadline = new Date(scheme.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : i18n.language === 'mr' ? 'mr-IN' : 'en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleApply = async () => {
    try {
      const supported = await Linking.canOpenURL(scheme.applicationLink);
      if (supported) {
        await Linking.openURL(scheme.applicationLink);
      } else {
        Alert.alert(
          t('common.error'),
          t('schemes.cannotOpenLink'),
        );
      }
    } catch (error) {
      console.error('Failed to open application link:', error);
      Alert.alert(
        t('common.error'),
        t('schemes.linkError'),
      );
    }
  };

  const daysLeft = getDaysLeft();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schemeName}>{getSchemeName()}</Text>
          <View style={[styles.categoryBadge, {backgroundColor: '#2196F3'}]}>
            <Text style={styles.categoryText}>{scheme.schemeType}</Text>
          </View>
          {scheme.isEligible && (
            <View style={styles.eligibleBadge}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.eligibleText}>{t('schemes.eligible')}</Text>
            </View>
          )}
        </View>

        {/* Deadline Alert */}
        {daysLeft > 0 && daysLeft <= 30 && (
          <View style={styles.deadlineAlert}>
            <Icon name="schedule" size={24} color="#FF9800" />
            <View style={styles.deadlineContent}>
              <Text style={styles.deadlineTitle}>{t('schemes.deadlineAlert')}</Text>
              <Text style={styles.deadlineText}>
                {t('schemes.daysLeft', {days: daysLeft})} - {formatDate(scheme.deadline)}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemes.description')}</Text>
          <Text style={styles.descriptionText}>{getDescription()}</Text>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemes.benefits')}</Text>
          <View style={styles.benefitsCard}>
            <Icon name="account-balance-wallet" size={32} color="#4CAF50" />
            <View style={styles.benefitsContent}>
              <Text style={styles.benefitsAmount}>
                ₹{scheme.benefitsAmount.toLocaleString()}
              </Text>
              <Text style={styles.benefitsDescription}>
                {getBenefitsDescription()}
              </Text>
            </View>
          </View>
        </View>

        {/* Eligibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemes.eligibility')}</Text>
          <View style={styles.eligibilityCard}>
            {scheme.eligibility.maxLandHectares && (
              <View style={styles.eligibilityRow}>
                <Icon name="landscape" size={20} color="#666" />
                <Text style={styles.eligibilityText}>
                  {t('schemes.maxLand')}: {scheme.eligibility.maxLandHectares} {t('farm.hectares')}
                </Text>
              </View>
            )}
            {scheme.eligibility.minLandHectares && (
              <View style={styles.eligibilityRow}>
                <Icon name="landscape" size={20} color="#666" />
                <Text style={styles.eligibilityText}>
                  {t('schemes.minLand')}: {scheme.eligibility.minLandHectares} {t('farm.hectares')}
                </Text>
              </View>
            )}
            {scheme.eligibility.cropTypes && scheme.eligibility.cropTypes.length > 0 && (
              <View style={styles.eligibilityRow}>
                <Icon name="eco" size={20} color="#666" />
                <Text style={styles.eligibilityText}>
                  {t('schemes.crops')}: {scheme.eligibility.cropTypes.join(', ')}
                </Text>
              </View>
            )}
            {scheme.eligibility.states && scheme.eligibility.states.length > 0 && (
              <View style={styles.eligibilityRow}>
                <Icon name="location-on" size={20} color="#666" />
                <Text style={styles.eligibilityText}>
                  {t('schemes.states')}: {scheme.eligibility.states.join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Required Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemes.documents')}</Text>
          {scheme.documents.map((doc, index) => (
            <View key={index} style={styles.documentRow}>
              <Icon name="description" size={20} color="#2196F3" />
              <Text style={styles.documentText}>{doc}</Text>
            </View>
          ))}
        </View>

        {/* Deadline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemes.deadline')}</Text>
          <View style={styles.deadlineCard}>
            <Icon name="event" size={24} color="#FF5722" />
            <Text style={styles.deadlineDate}>{formatDate(scheme.deadline)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Icon name="open-in-new" size={20} color="#fff" />
          <Text style={styles.applyButtonText}>{t('schemes.apply')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  schemeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  eligibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  eligibleText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  deadlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  deadlineContent: {
    flex: 1,
    marginLeft: 12,
  },
  deadlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 4,
  },
  deadlineText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  benefitsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
  },
  benefitsContent: {
    flex: 1,
    marginLeft: 16,
  },
  benefitsAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  benefitsDescription: {
    fontSize: 14,
    color: '#666',
  },
  eligibilityCard: {
    gap: 12,
  },
  eligibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eligibilityText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  deadlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 8,
  },
  deadlineDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5722',
    marginLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
