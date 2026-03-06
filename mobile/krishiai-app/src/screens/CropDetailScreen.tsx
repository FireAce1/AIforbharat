/**
 * Crop Detail Screen
 * Displays detailed information about a crop recommendation
 * Validates: Requirements 4.1-4.5
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSelector, useDispatch} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {MainTabParamList} from '../types/navigation';
import type {RootState} from '../store';
import {updateFarmSuccess} from '../store/slices/farmSlice';
import {database} from '../database';

type CropDetailScreenProps = NativeStackScreenProps<
  MainTabParamList,
  'CropDetail'
>;

const CropDetailScreen: React.FC<CropDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const {recommendation} = route.params;
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);

  // Redux state
  const farms = useSelector((state: RootState) => state.farm.farms);

  /**
   * Get risk level color
   */
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return '#43A047';
      case 'Medium':
        return '#FB8C00';
      case 'High':
        return '#E53935';
      default:
        return '#666';
    }
  };

  /**
   * Format date range
   */
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const formatDate = (date: Date) => {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${date.getDate()} ${months[date.getMonth()]}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  /**
   * Calculate profit percentage
   */
  const calculateProfitPercentage = () => {
    const profit =
      recommendation.expectedRevenue - recommendation.investmentRequired;
    const percentage = (profit / recommendation.investmentRequired) * 100;
    return Math.round(percentage);
  };

  /**
   * Save crop selection to farm profile
   */
  const selectCrop = async () => {
    if (farms.length === 0) {
      Alert.alert(t('errors.error'), t('crop.noFarmProfile'));
      return;
    }

    setSaving(true);

    try {
      const farm = farms[0];

      // Update farm with selected crop in WatermelonDB
      await database.write(async () => {
        const farmRecord = await database.get('farms').find(farm.id);
        await farmRecord.update((record: any) => {
          record.selectedCrop = recommendation.crop;
          record.updatedAt = new Date();
        });
      });

      // Update Redux state
      dispatch(
        updateFarmSuccess({
          ...farm,
          selectedCrop: recommendation.crop,
          updatedAt: new Date().toISOString(),
        }),
      );

      Alert.alert(
        t('common.success'),
        t('crop.cropSelected').replace('{{crop}}', recommendation.crop),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.navigate('Home'),
          },
        ],
      );
    } catch (err) {
      console.error('Error saving crop selection:', err);
      Alert.alert(t('errors.error'), t('errors.unknownError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.cropName}>{recommendation.crop}</Text>
          <View
            style={[
              styles.riskBadge,
              {backgroundColor: getRiskColor(recommendation.riskLevel)},
            ]}>
            <Text style={styles.riskBadgeText}>
              {t(`crop.riskLevels.${recommendation.riskLevel.toLowerCase()}`)}
            </Text>
          </View>
        </View>

        {/* Confidence Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.confidence')}</Text>
          <View style={styles.confidenceContainer}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: `${recommendation.confidence}%`},
                ]}
              />
            </View>
            <Text style={styles.confidenceValue}>
              {Math.round(recommendation.confidence)}%
            </Text>
          </View>
          <Text style={styles.confidenceDescription}>
            {t('crop.confidenceDescription')}
          </Text>
        </View>

        {/* Financial Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.financialDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('crop.investment')}</Text>
            <Text style={styles.detailValue}>
              ₹{recommendation.investmentRequired.toLocaleString()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('crop.revenue')}</Text>
            <Text style={styles.detailValue}>
              ₹{recommendation.expectedRevenue.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.detailRow, styles.highlightRow]}>
            <Text style={[styles.detailLabel, styles.highlightLabel]}>
              {t('crop.profit')}
            </Text>
            <Text style={[styles.detailValue, styles.profitValue]}>
              ₹
              {Math.round(
                recommendation.expectedRevenue -
                  recommendation.investmentRequired,
              ).toLocaleString()}
            </Text>
          </View>

          <View style={styles.profitPercentageContainer}>
            <Text style={styles.profitPercentageText}>
              {calculateProfitPercentage()}% {t('crop.returnOnInvestment')}
            </Text>
          </View>
        </View>

        {/* Yield Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.yieldDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('crop.expectedYield')}</Text>
            <Text style={styles.detailValue}>
              {recommendation.expectedYield} {t('crop.tonsPerHectare')}
            </Text>
          </View>

          <Text style={styles.yieldNote}>{t('crop.yieldNote')}</Text>
        </View>

        {/* Water Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.waterNeeds')}</Text>

          <View style={styles.waterContainer}>
            <Text style={styles.waterIcon}>💧</Text>
            <View style={styles.waterDetails}>
              <Text style={styles.waterAmount}>
                {recommendation.waterRequirements} {t('crop.mmPerSeason')}
              </Text>
              <Text style={styles.waterDescription}>
                {t('crop.waterDescription')}
              </Text>
            </View>
          </View>
        </View>

        {/* Sowing Window */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.sowingWindow')}</Text>

          <View style={styles.sowingContainer}>
            <Text style={styles.sowingIcon}>📅</Text>
            <View style={styles.sowingDetails}>
              <Text style={styles.sowingDates}>
                {formatDateRange(
                  recommendation.sowingWindow.start,
                  recommendation.sowingWindow.end,
                )}
              </Text>
              <Text style={styles.sowingDescription}>
                {t('crop.sowingDescription')}
              </Text>
            </View>
          </View>
        </View>

        {/* Risk Assessment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('crop.riskAssessment')}</Text>

          <View
            style={[
              styles.riskContainer,
              {borderLeftColor: getRiskColor(recommendation.riskLevel)},
            ]}>
            <Text
              style={[
                styles.riskLevel,
                {color: getRiskColor(recommendation.riskLevel)},
              ]}>
              {t(`crop.riskLevels.${recommendation.riskLevel.toLowerCase()}`)} {t('crop.risk')}
            </Text>
            <Text style={styles.riskDescription}>
              {t(`crop.riskDescriptions.${recommendation.riskLevel.toLowerCase()}`)}
            </Text>
          </View>
        </View>

        {/* Select Crop Button */}
        <TouchableOpacity
          style={[styles.selectButton, saving && styles.selectButtonDisabled]}
          onPress={selectCrop}
          disabled={saving}>
          <Text style={styles.selectButtonText}>
            {saving ? t('common.saving') : t('crop.selectThisCrop')}
          </Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>{t('crop.disclaimer')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  cropName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  riskBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  confidenceContainer: {
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 6,
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'right',
  },
  confidenceDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  highlightRow: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginTop: 8,
    borderBottomWidth: 0,
  },
  highlightLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
  },
  profitValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  profitPercentageContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  profitPercentageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#43A047',
  },
  yieldNote: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  waterDetails: {
    flex: 1,
  },
  waterAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 4,
  },
  waterDescription: {
    fontSize: 14,
    color: '#666',
  },
  sowingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sowingIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  sowingDetails: {
    flex: 1,
  },
  sowingDates: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FB8C00',
    marginBottom: 4,
  },
  sowingDescription: {
    fontSize: 14,
    color: '#666',
  },
  riskContainer: {
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  riskLevel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  riskDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  selectButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF9C4',
    borderRadius: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default CropDetailScreen;
