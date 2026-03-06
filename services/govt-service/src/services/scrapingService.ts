import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface SchemeData {
  scheme_name: string;
  scheme_name_hi?: string;
  scheme_name_mr?: string;
  description?: string;
  description_hi?: string;
  description_mr?: string;
  benefits_amount?: number;
  benefits_description?: string;
  benefits_description_hi?: string;
  benefits_description_mr?: string;
  eligibility_criteria?: any;
  required_documents?: any;
  application_deadline?: Date;
  application_link?: string;
  scheme_type: string;
  state?: string;
}

export class ScrapingService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: config.scraping.timeout,
      headers: {
        'User-Agent': config.scraping.userAgent,
      },
    });
  }

  /**
   * Scrape PM-KISAN scheme data
   */
  async scrapePMKisan(): Promise<SchemeData[]> {
    logger.info('Scraping PM-KISAN scheme data');
    const schemes: SchemeData[] = [];

    try {
      // Mock data for PM-KISAN (in production, this would scrape actual portal)
      schemes.push({
        scheme_name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
        scheme_name_hi: 'पीएम-किसान (प्रधानमंत्री किसान सम्मान निधि)',
        scheme_name_mr: 'पीएम-किसान (प्रधानमंत्री किसान सन्मान निधी)',
        description: 'Income support of ₹6,000 per year to all farmer families in three equal installments',
        description_hi: 'सभी किसान परिवारों को तीन समान किस्तों में प्रति वर्ष ₹6,000 की आय सहायता',
        description_mr: 'सर्व शेतकरी कुटुंबांना तीन समान हप्त्यांमध्ये दरवर्षी ₹6,000 उत्पन्न सहाय्य',
        benefits_amount: 6000,
        benefits_description: '₹2,000 every 4 months directly to bank account',
        benefits_description_hi: 'हर 4 महीने में ₹2,000 सीधे बैंक खाते में',
        benefits_description_mr: 'दर 4 महिन्यांनी ₹2,000 थेट बँक खात्यात',
        eligibility_criteria: {
          max_land_hectares: 2,
          farmer_categories: ['small', 'marginal'],
          states: ['all'],
        },
        required_documents: ['Aadhaar Card', 'Bank Account Details', 'Land Ownership Documents'],
        application_link: 'https://pmkisan.gov.in/',
        scheme_type: 'income_support',
        state: 'all',
      });

      logger.info(`Scraped ${schemes.length} schemes from PM-KISAN`);
    } catch (error) {
      logger.error('Failed to scrape PM-KISAN', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return schemes;
  }

  /**
   * Scrape PMFBY (Pradhan Mantri Fasal Bima Yojana) scheme data
   */
  async scrapePMFBY(): Promise<SchemeData[]> {
    logger.info('Scraping PMFBY scheme data');
    const schemes: SchemeData[] = [];

    try {
      // Mock data for PMFBY (in production, this would scrape actual portal)
      schemes.push({
        scheme_name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
        scheme_name_hi: 'पीएमएफबीवाई (प्रधानमंत्री फसल बीमा योजना)',
        scheme_name_mr: 'पीएमएफबीवाय (प्रधानमंत्री फसल विमा योजना)',
        description: 'Crop insurance scheme providing financial support to farmers in case of crop failure',
        description_hi: 'फसल विफलता की स्थिति में किसानों को वित्तीय सहायता प्रदान करने वाली फसल बीमा योजना',
        description_mr: 'पीक अपयशाच्या परिस्थितीत शेतकऱ्यांना आर्थिक सहाय्य प्रदान करणारी पीक विमा योजना',
        benefits_description: 'Comprehensive risk insurance covering yield losses due to non-preventable risks',
        benefits_description_hi: 'गैर-रोकथाम योग्य जोखिमों के कारण उपज हानि को कवर करने वाला व्यापक जोखिम बीमा',
        benefits_description_mr: 'प्रतिबंध न करता येणाऱ्या जोखमांमुळे उत्पन्न नुकसान कव्हर करणारा सर्वसमावेशक जोखीम विमा',
        eligibility_criteria: {
          crop_types: ['rice', 'wheat', 'cotton', 'sugarcane', 'oilseeds', 'pulses'],
          states: ['all'],
        },
        required_documents: ['Aadhaar Card', 'Bank Account Details', 'Land Records', 'Sowing Certificate'],
        application_link: 'https://pmfby.gov.in/',
        scheme_type: 'insurance',
        state: 'all',
      });

      logger.info(`Scraped ${schemes.length} schemes from PMFBY`);
    } catch (error) {
      logger.error('Failed to scrape PMFBY', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return schemes;
  }

  /**
   * Scrape KCC (Kisan Credit Card) scheme data
   */
  async scrapeKCC(): Promise<SchemeData[]> {
    logger.info('Scraping KCC scheme data');
    const schemes: SchemeData[] = [];

    try {
      // Mock data for KCC (in production, this would scrape actual portal)
      schemes.push({
        scheme_name: 'KCC (Kisan Credit Card)',
        scheme_name_hi: 'केसीसी (किसान क्रेडिट कार्ड)',
        scheme_name_mr: 'केसीसी (किसान क्रेडिट कार्ड)',
        description: 'Credit facility for farmers to meet short-term credit requirements for cultivation and other needs',
        description_hi: 'किसानों के लिए खेती और अन्य जरूरतों के लिए अल्पकालिक ऋण आवश्यकताओं को पूरा करने के लिए ऋण सुविधा',
        description_mr: 'शेतकऱ्यांसाठी लागवड आणि इतर गरजांसाठी अल्पकालीन कर्ज आवश्यकता पूर्ण करण्यासाठी कर्ज सुविधा',
        benefits_description: 'Low-interest credit up to ₹3 lakh with flexible repayment',
        benefits_description_hi: 'लचीली पुनर्भुगतान के साथ ₹3 लाख तक का कम ब्याज ऋण',
        benefits_description_mr: 'लवचिक परतफेडीसह ₹3 लाखांपर्यंत कमी व्याज कर्ज',
        eligibility_criteria: {
          farmer_categories: ['all'],
          states: ['all'],
        },
        required_documents: ['Aadhaar Card', 'Land Ownership Documents', 'Income Proof'],
        application_link: 'https://www.nabard.org/content1.aspx?id=523&catid=8&mid=530',
        scheme_type: 'credit',
        state: 'all',
      });

      logger.info(`Scraped ${schemes.length} schemes from KCC`);
    } catch (error) {
      logger.error('Failed to scrape KCC', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return schemes;
  }

  /**
   * Scrape Maharashtra state schemes
   */
  async scrapeMaharashtraSchemes(): Promise<SchemeData[]> {
    logger.info('Scraping Maharashtra state schemes');
    const schemes: SchemeData[] = [];

    try {
      // Mock data for Maharashtra schemes (in production, this would scrape actual portal)
      schemes.push({
        scheme_name: 'Maharashtra Krishi Samruddhi Yojana',
        scheme_name_hi: 'महाराष्ट्र कृषि समृद्धि योजना',
        scheme_name_mr: 'महाराष्ट्र कृषी समृद्धी योजना',
        description: 'State scheme for agricultural development and farmer welfare',
        description_hi: 'कृषि विकास और किसान कल्याण के लिए राज्य योजना',
        description_mr: 'कृषी विकास आणि शेतकरी कल्याणासाठी राज्य योजना',
        benefits_description: 'Subsidies on seeds, fertilizers, and farm equipment',
        benefits_description_hi: 'बीज, उर्वरक और कृषि उपकरण पर सब्सिडी',
        benefits_description_mr: 'बियाणे, खते आणि शेती उपकरणांवर अनुदान',
        eligibility_criteria: {
          states: ['Maharashtra'],
          max_land_hectares: 5,
        },
        required_documents: ['Aadhaar Card', 'Ration Card', 'Land Records'],
        application_link: 'https://krishi.maharashtra.gov.in/',
        scheme_type: 'subsidy',
        state: 'Maharashtra',
      });

      logger.info(`Scraped ${schemes.length} schemes from Maharashtra`);
    } catch (error) {
      logger.error('Failed to scrape Maharashtra schemes', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return schemes;
  }

  /**
   * Scrape all government schemes from various portals
   */
  async scrapeAllSchemes(): Promise<SchemeData[]> {
    logger.info('Starting comprehensive scheme scraping');
    
    const allSchemes: SchemeData[] = [];

    try {
      const [pmKisan, pmfby, kcc, maharashtra] = await Promise.allSettled([
        this.scrapePMKisan(),
        this.scrapePMFBY(),
        this.scrapeKCC(),
        this.scrapeMaharashtraSchemes(),
      ]);

      if (pmKisan.status === 'fulfilled') {
        allSchemes.push(...pmKisan.value);
      }
      if (pmfby.status === 'fulfilled') {
        allSchemes.push(...pmfby.value);
      }
      if (kcc.status === 'fulfilled') {
        allSchemes.push(...kcc.value);
      }
      if (maharashtra.status === 'fulfilled') {
        allSchemes.push(...maharashtra.value);
      }

      logger.info(`Total schemes scraped: ${allSchemes.length}`);
    } catch (error) {
      logger.error('Error during comprehensive scraping', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return allSchemes;
  }
}

export const scrapingService = new ScrapingService();
