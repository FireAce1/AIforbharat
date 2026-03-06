/**
 * Treatment Disclaimer Component
 * Displays agricultural safety disclaimer for treatment recommendations
 * Requirement 20.6: Provide disclaimer that recommendations are advisory
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TreatmentDisclaimerProps {
  visible: boolean;
  onAccept: () => void;
  onCancel?: () => void;
  compact?: boolean; // Show compact version inline
}

const TreatmentDisclaimer: React.FC<TreatmentDisclaimerProps> = ({
  visible,
  onAccept,
  onCancel,
  compact = false
}) => {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const getDisclaimerText = () => {
    const language = i18n.language;
    
    if (language === 'hi') {
      return {
        title: '⚠️ महत्वपूर्ण अस्वीकरण',
        points: [
          'ये उपचार सिफारिशें केवल सलाहकार हैं और AI विश्लेषण पर आधारित हैं।',
          'उपचार लागू करने से पहले हमेशा स्थानीय कृषि विशेषज्ञों से परामर्श करें।',
          'सभी सुरक्षा सावधानियों और सुरक्षात्मक उपकरण दिशानिर्देशों का पालन करें।',
          'अनुशंसित खुराक और अनुप्रयोग विधियों का पालन करें।',
          'रासायनिक उपचार के लिए फसल-पूर्व प्रतीक्षा अवधि का सम्मान करें।',
          'सुरक्षा और स्थिरता के लिए जैविक उपचार को प्राथमिकता दी जाती है।',
          'रासायनिक उपचार का उपयोग केवल आवश्यक होने पर ही करें।'
        ],
        footer: 'व्यक्तिगत सलाह के लिए, अपने निकटतम कृषि विज्ञान केंद्र (KVK) या कृषि विस्तार अधिकारी से संपर्क करें।',
        accept: 'समझ गया',
        cancel: 'रद्द करें',
        readMore: 'और पढ़ें',
        readLess: 'कम पढ़ें'
      };
    } else if (language === 'mr') {
      return {
        title: '⚠️ महत्त्वाचे अस्वीकरण',
        points: [
          'या उपचार शिफारसी केवळ सल्लागार आहेत आणि AI विश्लेषणावर आधारित आहेत।',
          'उपचार लागू करण्यापूर्वी नेहमी स्थानिक कृषी तज्ञांचा सल्ला घ्या।',
          'सर्व सुरक्षा खबरदारी आणि संरक्षक उपकरण मार्गदर्शक तत्त्वांचे पालन करा।',
          'शिफारस केलेल्या डोसच्या आणि अनुप्रयोग पद्धतींचे पालन करा।',
          'रासायनिक उपचारांसाठी कापणीपूर्व प्रतीक्षा कालावधीचा आदर करा।',
          'सुरक्षितता आणि शाश्वततेसाठी सेंद्रिय उपचारांना प्राधान्य दिले जाते।',
          'रासायनिक उपचार फक्त आवश्यक असताना वापरावे।'
        ],
        footer: 'वैयक्तिक सल्ल्यासाठी, तुमच्या जवळच्या कृषी विज्ञान केंद्र (KVK) किंवा कृषी विस्तार अधिकाऱ्याशी संपर्क साधा।',
        accept: 'समजले',
        cancel: 'रद्द करा',
        readMore: 'अधिक वाचा',
        readLess: 'कमी वाचा'
      };
    } else {
      return {
        title: '⚠️ IMPORTANT DISCLAIMER',
        points: [
          'These treatment recommendations are advisory only and based on AI analysis.',
          'Always consult with local agricultural experts before applying treatments.',
          'Follow all safety precautions and protective equipment guidelines.',
          'Adhere to recommended dosages and application methods.',
          'Respect pre-harvest waiting periods for chemical treatments.',
          'Organic treatments are prioritized for safety and sustainability.',
          'Chemical treatments should be used only when necessary.'
        ],
        footer: 'For personalized advice, contact your nearest Krishi Vigyan Kendra (KVK) or agricultural extension officer.',
        accept: 'I Understand',
        cancel: 'Cancel',
        readMore: 'Read More',
        readLess: 'Read Less'
      };
    }
  };

  const disclaimer = getDisclaimerText();

  // Compact inline version
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Icon name="warning" size={20} color="#FF9800" />
          <Text style={styles.compactTitle}>{disclaimer.title}</Text>
        </View>
        
        {!expanded && (
          <TouchableOpacity onPress={() => setExpanded(true)}>
            <Text style={styles.readMoreText}>{disclaimer.readMore}</Text>
          </TouchableOpacity>
        )}
        
        {expanded && (
          <View style={styles.compactContent}>
            {disclaimer.points.map((point, index) => (
              <View key={index} style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
            <Text style={styles.footerText}>{disclaimer.footer}</Text>
            <TouchableOpacity onPress={() => setExpanded(false)}>
              <Text style={styles.readMoreText}>{disclaimer.readLess}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Full modal version
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Icon name="warning" size={32} color="#FF9800" />
            <Text style={styles.title}>{disclaimer.title}</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {disclaimer.points.map((point, index) => (
              <View key={index} style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>{disclaimer.footer}</Text>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>{disclaimer.cancel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
            >
              <Text style={styles.acceptButtonText}>{disclaimer.accept}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: width - 40,
    maxHeight: height * 0.8,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginLeft: 12,
    flex: 1
  },
  content: {
    flex: 1,
    marginBottom: 16
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingRight: 8
  },
  bullet: {
    fontSize: 18,
    color: '#FF9800',
    marginRight: 8,
    marginTop: 2
  },
  pointText: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 24,
    flex: 1
  },
  footerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800'
  },
  footerText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    fontStyle: 'italic'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  acceptButton: {
    backgroundColor: '#4CAF50'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242'
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
  },

  // Compact inline styles
  compactContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800'
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginLeft: 8,
    flex: 1
  },
  compactContent: {
    marginTop: 8
  },
  readMoreText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 4
  }
});

export default TreatmentDisclaimer;
