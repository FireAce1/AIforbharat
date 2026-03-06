import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../store';
import {fetchForecastsRequest} from '../store/slices/weatherSlice';
import Icon from 'react-native-vector-icons/MaterialIcons';

const WeatherForecastScreen = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {forecasts, forecastsLastUpdated, alerts, isLoading, error} =
    useAppSelector(state => state.weather);
  const {farms, selectedFarmId} = useAppSelector(state => state.farm);
  const currentFarm = farms.find(f => f.id === selectedFarmId);

  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Fetch forecasts on mount
    if (currentFarm) {
      dispatch(fetchForecastsRequest());
    }
  }, [dispatch, currentFarm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    dispatch(fetchForecastsRequest());
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return t('weather.today');
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return t('weather.tomorrow');
    } else {
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return t('common.justNow');
    } else if (diffHours < 24) {
      return t('common.hoursAgo', {count: diffHours});
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return t('common.daysAgo', {count: diffDays});
    }
  };

  const getWeatherIcon = (temp: number, rainfall: number) => {
    if (rainfall > 10) {
      return 'thunderstorm';
    } else if (rainfall > 0) {
      return 'grain';
    } else if (temp > 35) {
      return 'wb-sunny';
    } else if (temp < 15) {
      return 'ac-unit';
    } else {
      return 'wb-cloudy';
    }
  };

  const getAlertIcon = (
    type: 'HEAVY_RAINFALL' | 'EXTREME_HEAT' | 'FROST' | 'HIGH_WIND' | 'HAIL',
  ) => {
    switch (type) {
      case 'HEAVY_RAINFALL':
        return 'water-drop';
      case 'EXTREME_HEAT':
        return 'local-fire-department';
      case 'FROST':
        return 'ac-unit';
      case 'HIGH_WIND':
        return 'air';
      case 'HAIL':
        return 'grain';
      default:
        return 'warning';
    }
  };

  const getAlertColor = (severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (severity) {
      case 'CRITICAL':
        return '#D32F2F';
      case 'HIGH':
        return '#F57C00';
      case 'MEDIUM':
        return '#FBC02D';
      case 'LOW':
        return '#388E3C';
      default:
        return '#757575';
    }
  };

  if (!currentFarm) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Icon name="cloud-off" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>{t('weather.noFarmSelected')}</Text>
          <Text style={styles.emptySubtext}>
            {t('weather.addFarmToViewWeather')}
          </Text>
        </View>
      </View>
    );
  }

  const selectedForecast = forecasts[selectedDay];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('weather.weatherForecast')}</Text>
        {forecastsLastUpdated && (
          <Text style={styles.lastUpdated}>
            {t('weather.lastUpdated', {
              time: formatRelativeTime(forecastsLastUpdated),
            })}
          </Text>
        )}
      </View>

      {/* Critical Weather Alerts */}
      {alerts.length > 0 && (
        <View style={styles.alertsSection}>
          {alerts.map(alert => (
            <View
              key={alert.id}
              style={[
                styles.alertBanner,
                {backgroundColor: getAlertColor(alert.severity)},
              ]}>
              <Icon
                name={getAlertIcon(alert.type)}
                size={24}
                color="#FFF"
                style={styles.alertIcon}
              />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>
                  {t(`weather.alert.${alert.type}`)}
                </Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 7-Day Forecast Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('weather.sevenDayForecast')}</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#4CAF50" />
        ) : forecasts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.forecastCards}>
            {forecasts.map((forecast, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.forecastCard,
                  selectedDay === index && styles.forecastCardSelected,
                ]}
                onPress={() => setSelectedDay(index)}>
                <Text style={styles.forecastDate}>
                  {formatDate(forecast.date)}
                </Text>
                <Icon
                  name={getWeatherIcon(
                    (forecast.tempMax + forecast.tempMin) / 2,
                    forecast.rainfall,
                  )}
                  size={32}
                  color={selectedDay === index ? '#FFF' : '#4CAF50'}
                  style={styles.forecastIcon}
                />
                <Text
                  style={[
                    styles.forecastTemp,
                    selectedDay === index && styles.forecastTempSelected,
                  ]}>
                  {forecast.tempMax}° / {forecast.tempMin}°
                </Text>
                {forecast.rainfall > 0 && (
                  <Text
                    style={[
                      styles.forecastRain,
                      selectedDay === index && styles.forecastRainSelected,
                    ]}>
                    {forecast.rainfall}mm
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {t('weather.noForecastAvailable')}
            </Text>
          </View>
        )}
      </View>

      {/* Hourly Breakdown */}
      {selectedForecast && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('weather.hourlyBreakdown')}
          </Text>
          <View style={styles.hourlyContainer}>
            {selectedForecast.hourly.map((hour, index) => (
              <View key={index} style={styles.hourlyItem}>
                <Text style={styles.hourlyTime}>{formatTime(hour.time)}</Text>
                <Icon
                  name={getWeatherIcon(hour.temperature, hour.rainfall)}
                  size={24}
                  color="#4CAF50"
                />
                <Text style={styles.hourlyTemp}>{hour.temperature}°C</Text>
                <View style={styles.hourlyDetails}>
                  <View style={styles.hourlyDetailRow}>
                    <Icon name="water-drop" size={14} color="#2196F3" />
                    <Text style={styles.hourlyDetailText}>
                      {hour.rainfall}mm
                    </Text>
                  </View>
                  <View style={styles.hourlyDetailRow}>
                    <Icon name="opacity" size={14} color="#00BCD4" />
                    <Text style={styles.hourlyDetailText}>
                      {hour.humidity}%
                    </Text>
                  </View>
                  <View style={styles.hourlyDetailRow}>
                    <Icon name="air" size={14} color="#607D8B" />
                    <Text style={styles.hourlyDetailText}>
                      {hour.windSpeed}km/h
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#757575',
  },
  alertsSection: {
    marginTop: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 1,
  },
  alertIcon: {
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 14,
    color: '#FFF',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  forecastCards: {
    flexDirection: 'row',
  },
  forecastCard: {
    width: 100,
    padding: 12,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  forecastCardSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  forecastDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  forecastIcon: {
    marginVertical: 8,
  },
  forecastTemp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },
  forecastTempSelected: {
    color: '#FFF',
  },
  forecastRain: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 4,
  },
  forecastRainSelected: {
    color: '#E3F2FD',
  },
  hourlyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  hourlyItem: {
    width: '25%',
    padding: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  hourlyTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginVertical: 4,
  },
  hourlyDetails: {
    marginTop: 4,
  },
  hourlyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  hourlyDetailText: {
    fontSize: 10,
    color: '#757575',
    marginLeft: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
});

export default WeatherForecastScreen;
