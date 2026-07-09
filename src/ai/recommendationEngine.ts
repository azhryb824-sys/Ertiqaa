// AI Recommendation Engine for Elevator Maintenance
// This module provides intelligent recommendations based on multiple data sources

import { knowledgeBase } from './elevatorKnowledgeBase';

interface ElevatorData {
  id: string;
  manufacturer?: string;
  model?: string;
  controlPanel?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  components?: Array<{
    name: string;
    age?: number;
    condition?: 'good' | 'fair' | 'poor' | 'critical';
    lastReplaced?: string;
  }>;
  operatingConditions?: {
    dailyTrips?: number;
    loadFactor?: number;
    environment?: 'normal' | 'harsh' | 'extreme';
  };
}

interface MaintenanceHistory {
  elevatorId: string;
  visits: Array<{
    date: string;
    type: string;
    findings: string;
    actions: string;
    partsReplaced: string[];
    faultCodes?: string[];
  }>;
  faultHistory: Array<{
    code: string;
    date: string;
    frequency: number;
  }>;
}

interface RecommendationContext {
  elevatorData: ElevatorData;
  maintenanceHistory: MaintenanceHistory;
  currentIssue?: {
    description: string;
    faultCode?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  };
  environmentalConditions?: {
    temperature?: number;
    humidity?: number;
    dustLevel?: 'low' | 'medium' | 'high';
  };
}

interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'safety' | 'maintenance' | 'efficiency' | 'cost' | 'compliance';
  title: string;
  description: string;
  reasoning: string[];
  confidence: number; // 0-100
  dataSources: string[];
  estimatedCost?: number;
  estimatedDuration?: number;
  requiredParts?: Array<{
    partNumber: string;
    name: string;
    quantity: number;
  }>;
  requiredSkills: string[];
  safetyImplications: string[];
  complianceStandards: string[];
  learningBased: boolean;
  historicalSuccessRate?: number;
}

interface RecommendationResult {
  recommendations: Recommendation[];
  summary: {
    totalRecommendations: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    estimatedTotalCost: number;
    estimatedTotalDuration: number;
  };
  dataQuality: {
    elevatorDataCompleteness: number;
    maintenanceHistoryDepth: number;
    knowledgeBaseCoverage: number;
    overallQuality: number;
  };
}

class RecommendationEngine {
  private confidenceWeights = {
    manufacturerGuides: 0.95,
    safetyStandards: 0.98,
    faultCodes: 0.90,
    maintenanceProcedures: 0.85,
    learningData: 0.75,
    environmentalFactors: 0.70,
    historicalPatterns: 0.80
  };

  generateRecommendations(context: RecommendationContext): RecommendationResult {
    const recommendations: Recommendation[] = [];
    const { elevatorData, maintenanceHistory, currentIssue, environmentalConditions } = context;

    // 1. Safety-critical recommendations (highest priority)
    recommendations.push(...this.generateSafetyRecommendations(context));

    // 2. Issue-specific recommendations if current issue exists
    if (currentIssue) {
      recommendations.push(...this.generateIssueSpecificRecommendations(context));
    }

    // 3. Preventive maintenance recommendations
    recommendations.push(...this.generatePreventiveMaintenanceRecommendations(context));

    // 4. Environmental impact recommendations
    if (environmentalConditions) {
      recommendations.push(...this.generateEnvironmentalRecommendations(context));
    }

    // 5. Learning-based recommendations from historical data
    recommendations.push(...this.generateLearningBasedRecommendations(context));

    // 6. Compliance recommendations
    recommendations.push(...this.generateComplianceRecommendations(context));

    // Sort by priority and confidence
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    return {
      recommendations: recommendations.slice(0, 20), // Limit to top 20
      summary: this.calculateSummary(recommendations),
      dataQuality: this.assessDataQuality(context)
    };
  }

  private generateSafetyRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { elevatorData, maintenanceHistory } = context;

    // Check for safety-critical components
    if (elevatorData.components) {
      elevatorData.components.forEach(component => {
        if (component.condition === 'critical') {
          const safetyStandard = knowledgeBase.getSafetyStandards('general_safety')[0];
          recommendations.push({
            id: `SAFETY-${Date.now()}-${component.name}`,
            priority: 'critical',
            category: 'safety',
            title: `فحص طارئ لـ ${component.name}`,
            description: `حالة ${component.name} حرجة وتتطلب تدخل فوري لضمان السلامة`,
            reasoning: [
              `حالة المكون حرجة بناءً على آخر فحص`,
              `المعايير السلامة ${safetyStandard.standardId} تتطلب فحص فوري`,
              `خطر على سلامة المستخدمين إذا لم يتم المعالجة`
            ],
            confidence: 98,
            dataSources: ['component_condition', 'safety_standards'],
            requiredSkills: ['advanced_technician'],
            safetyImplications: ['خطر على سلامة المستخدمين', 'احتمال توقف المصعد'],
            complianceStandards: [safetyStandard.standardId],
            learningBased: false
          });
        }
      });
    }

    // Check for overdue safety inspections
    const lastMaintenance = elevatorData.lastMaintenanceDate ? new Date(elevatorData.lastMaintenanceDate) : new Date(0);
    const daysSinceMaintenance = Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceMaintenance > 180) { // 6 months
      recommendations.push({
        id: `SAFETY-${Date.now()}-OVERDUE`,
        priority: 'high',
        category: 'safety',
        title: 'فحص سلامة overdue',
        description: `آخر صيانة منذ ${daysSinceMaintenance} يوم، يتطلب فحص سلامة فوري`,
        reasoning: [
          `تجاوز الفترة الزمنية الموصى بها للفحص (180 يوم)`,
          `معايير EN 81 و ASME A17.1 تتطلب فحص دوري`,
          `ضمان استمرارية التشغيل الآمن`
        ],
        confidence: 95,
        dataSources: ['maintenance_history', 'safety_standards'],
        estimatedDuration: 120,
        requiredSkills: ['certified_inspector'],
        safetyImplications: ['عدم الامتثال للمعايير', 'خطر محتمل على السلامة'],
        complianceStandards: ['EN 81-1/2', 'ASME A17.1'],
        learningBased: false
      });
    }

    return recommendations;
  }

  private generateIssueSpecificRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { currentIssue, elevatorData } = context;

    if (!currentIssue) return recommendations;

    // Check fault codes if provided
    if (currentIssue.faultCode && elevatorData.controlPanel) {
      const faultCode = knowledgeBase.getFaultCode(elevatorData.controlPanel, currentIssue.faultCode);
      if (faultCode) {
        recommendations.push({
          id: `FAULT-${Date.now()}-${currentIssue.faultCode}`,
          priority: faultCode.severity,
          category: 'maintenance',
          title: `معالجة خطأ ${faultCode.code}: ${faultCode.description}`,
          description: faultCode.recommendedActions.join('، '),
          reasoning: [
            `كود الخطأ ${faultCode.code} محدد في نظام ${elevatorData.controlPanel}`,
            `الأسباب المحتملة: ${faultCode.possibleCauses.join('، ')}`,
            `الإجراءات الموصى بها من قبل الشركة المصنعة`
          ],
          confidence: 90,
          dataSources: ['fault_codes', 'manufacturer_data'],
          estimatedDuration: this.estimateDuration(faultCode.recommendedActions),
          requiredSkills: this.determineRequiredSkills(faultCode.diagnosticSteps),
          safetyImplications: faultCode.safetyImplications,
          complianceStandards: [],
          learningBased: false
        });
      }
    }

    // Analyze issue description for keywords
    const issueLower = currentIssue.description.toLowerCase();
    
    // Check for common issues
    if (issueLower.includes('door') || issueLower.includes('باب')) {
      recommendations.push({
        id: `ISSUE-${Date.now()}-DOOR`,
        priority: currentIssue.severity || 'medium',
        category: 'maintenance',
        title: 'فحص نظام الأبواب',
        description: 'مشكلة في نظام الأبواب تتطلب فحص شامل',
        reasoning: [
          'وصف المشكلة يشير إلى نظام الأبواب',
          'الأبواب من أكثر المكونات التي تسبب أعطال',
          'الفحص الشامل يغطي المحرك، الحساسات، والميكانيكية'
        ],
        confidence: 75,
        dataSources: ['issue_description', 'historical_patterns'],
        estimatedDuration: 60,
        requiredSkills: ['door_mechanic', 'electrical_basic'],
        safetyImplications: ['خطر انحشار المستخدمين', 'توقف الخدمة'],
        complianceStandards: ['EN 81-1/2'],
        learningBased: true
      });
    }

    if (issueLower.includes('noise') || issueLower.includes('صوت') || issueLower.includes('اهتزاز')) {
      recommendations.push({
        id: `ISSUE-${Date.now()}-NOISE`,
        priority: 'medium',
        category: 'maintenance',
        title: 'فحص مصدر الضوضاء والاهتزاز',
        description: 'ضوضاء أو اهتزاز غير طبيعي يتطلب تشخيص',
        reasoning: [
          'الضوضاء والاهتزاز قد تدل على مشاكل ميكانيكية',
          'قد تكون ناتجة عن احتكاك، تآكل، أو مشاكل في المحمل',
          'التشخيص المبكر يمنع أضرار أكبر'
        ],
        confidence: 70,
        dataSources: ['issue_description'],
        estimatedDuration: 90,
        requiredSkills: ['mechanical_expert'],
        safetyImplications: ['قد يؤدي لتلف المكونات'],
        complianceStandards: [],
        learningBased: false
      });
    }

    return recommendations;
  }

  private generatePreventiveMaintenanceRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { elevatorData, maintenanceHistory } = context;

    // Analyze component ages
    if (elevatorData.components) {
      elevatorData.components.forEach(component => {
        if (component.age && component.age > 120) { // Older than 10 years
          const procedures = knowledgeBase.getMaintenanceProcedures(component.name);
          if (procedures.length > 0) {
            const preventiveProcedure = procedures.find(p => p.procedureType === 'preventive');
            if (preventiveProcedure) {
              recommendations.push({
                id: `PREV-${Date.now()}-${component.name}`,
                priority: 'medium',
                category: 'maintenance',
                title: `صيانة وقائية لـ ${component.name}`,
                description: `المكون عمره ${Math.floor(component.age / 12)} سنة، يوصى بالصيانة الوقائية`,
                reasoning: [
                  `عمر المكون ${Math.floor(component.age / 12)} سنة يتجاوز العمر الافتراضي الموصى به`,
                  `الصيانة الوقائية ت延长 العمر التشغيلي`,
                  `إجراءات الشركة المصنعة متاحة لهذا المكون`
                ],
                confidence: 85,
                dataSources: ['component_age', 'manufacturer_procedures'],
                estimatedDuration: preventiveProcedure.estimatedDuration,
                requiredSkills: [preventiveProcedure.skillLevel],
                safetyImplications: [],
                complianceStandards: [],
                learningBased: false
              });
            }
          }
        }
      });
    }

    // Analyze usage patterns
    if (elevatorData.operatingConditions?.dailyTrips) {
      const dailyTrips = elevatorData.operatingConditions.dailyTrips;
      if (dailyTrips > 200) {
        recommendations.push({
          id: `PREV-${Date.now()}-HIGHUSAGE`,
          priority: 'medium',
          category: 'efficiency',
          title: 'جدول صيانة مكثف للاستخدام العالي',
          description: `الاستخدام اليومي ${dailyTrips} رحلة يتطلب جدول صيانة مكثف`,
          reasoning: [
            `استخدام عالي (${dailyTrips} رحلة يومياً)`,
            `التآكل أسرع مع الاستخدام المكثف`,
            `الصيانة المكثف تقلل الأعطال المفاجئة`
          ],
          confidence: 80,
          dataSources: ['usage_patterns'],
          estimatedDuration: 180,
          requiredSkills: ['experienced_technician'],
          safetyImplications: ['زيادة احتمال الأعطال'],
          complianceStandards: [],
          learningBased: true
        });
      }
    }

    return recommendations;
  }

  private generateEnvironmentalRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { environmentalConditions } = context;

    if (!environmentalConditions) return recommendations;

    const factors = knowledgeBase.getEnvironmentalFactors();

    // Temperature recommendations
    if (environmentalConditions.temperature && environmentalConditions.temperature > 35) {
      const tempFactor = factors.find(f => f.factor === 'temperature');
      if (tempFactor) {
        recommendations.push({
          id: `ENV-${Date.now()}-TEMP`,
          priority: 'medium',
          category: 'maintenance',
          title: 'تحسين التبريد في غرفة الماكينات',
          description: 'درجة الحرارة عالية، يتطلب تحسين نظام التبريد',
          reasoning: [
            `درجة الحرارة ${environmentalConditions.temperature}°C فوق الموصى به`,
            `الحرارة العالية تؤثر على المتحكم والمحرك`,
            tempFactor.impactDescription
          ],
          confidence: 85,
          dataSources: ['environmental_sensors', 'knowledge_base'],
          requiredSkills: ['hvac_technician'],
          safetyImplications: ['خطر تلف المكونات', 'احتمال توقف'],
          complianceStandards: [],
          learningBased: false
        });
      }
    }

    // Humidity recommendations
    if (environmentalConditions.humidity && environmentalConditions.humidity > 70) {
      const humidityFactor = factors.find(f => f.factor === 'humidity');
      if (humidityFactor) {
        recommendations.push({
          id: `ENV-${Date.now()}-HUMIDITY`,
          priority: 'medium',
          category: 'maintenance',
          title: 'التحكم في الرطوبة',
          description: 'الرطوبة عالية، يتطلب تركيب مزيل رطوبة',
          reasoning: [
            `الرطوبة ${environmentalConditions.humidity}% فوق الموصى به`,
            `الرطوبة العالية تسبب التآكل والأعطال الكهربائية`,
            humidityFactor.impactDescription
          ],
          confidence: 85,
          dataSources: ['environmental_sensors', 'knowledge_base'],
          requiredSkills: ['hvac_technician'],
          safetyImplications: ['خطر الأعطال الكهربائية', 'تآكل المكونات'],
          complianceStandards: [],
          learningBased: false
        });
      }
    }

    // Dust recommendations
    if (environmentalConditions.dustLevel && environmentalConditions.dustLevel === 'high') {
      const dustFactor = factors.find(f => f.factor === 'dust');
      if (dustFactor) {
        recommendations.push({
          id: `ENV-${Date.now()}-DUST`,
          priority: 'medium',
          category: 'maintenance',
          title: 'تحسين نظام الترشيح والتنظيف',
          description: 'مستوى الغبار عالي، يتطلب تحسين الترشيح وتكثيف التنظيف',
          reasoning: [
            'مستوى الغبار عالي في البيئة',
            'الغبار يسبب ارتفاع الحرارة وأعطال الحساسات',
            dustFactor.impactDescription
          ],
          confidence: 80,
          dataSources: ['environmental_assessment', 'knowledge_base'],
          requiredSkills: ['general_technician'],
          safetyImplications: ['أعطال الحساسات', 'ارتفاع الحرارة'],
          complianceStandards: [],
          learningBased: false
        });
      }
    }

    return recommendations;
  }

  private generateLearningBasedRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { elevatorData, maintenanceHistory } = context;

    // Analyze historical patterns
    const patterns = knowledgeBase.analyzePatterns(elevatorData.id);
    
    // Check for recurring faults
    patterns.commonFaults.forEach((frequency, faultCode) => {
      if (frequency >= 3) {
        recommendations.push({
          id: `LEARN-${Date.now()}-RECURRING-${faultCode}`,
          priority: 'high',
          category: 'maintenance',
          title: `معالجة خطأ متكرر ${faultCode}`,
          description: `الخطأ ${faultCode} تكرر ${frequency} مرات، يتطلب حل جذري`,
          reasoning: [
            `الخطأ ${faultCode} تكرر ${frequency} مرات في السجل`,
            `الحلول السابقة لم تكن فعالة بشكل دائم`,
            `يوصى بمراجعة شاملة للنظام المتأثر`
          ],
          confidence: 75 + Math.min(frequency * 5, 20), // Increase confidence with frequency
          dataSources: ['historical_patterns', 'learning_data'],
          requiredSkills: ['senior_technician'],
          safetyImplications: ['استمرار المشكلة', 'عدم رضا العملاء'],
          complianceStandards: [],
          learningBased: true,
          historicalSuccessRate: this.calculateSuccessRate(patterns, faultCode)
        });
      }
    });

    // Check for successful actions
    patterns.successfulActions.forEach((count, action) => {
      if (count >= 2) {
        recommendations.push({
          id: `LEARN-${Date.now()}-SUCCESS-${action.substring(0, 20)}`,
          priority: 'low',
          category: 'efficiency',
          title: `إجراء ناجح موصى به: ${action.substring(0, 50)}`,
          description: `هذا الإجراء أثبت نجاحه ${count} مرات سابقاً`,
          reasoning: [
            `الإجراء نجح ${count} مرات في السجل`,
            `يعتمد على البيانات التاريخية للمصعد`,
            `يقلل من التجريب والخطأ`
          ],
          confidence: 70 + Math.min(count * 5, 25),
          dataSources: ['historical_patterns', 'learning_data'],
          requiredSkills: ['experienced_technician'],
          safetyImplications: [],
          complianceStandards: [],
          learningBased: true,
          historicalSuccessRate: 100
        });
      }
    });

    return recommendations;
  }

  private generateComplianceRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const { elevatorData, maintenanceHistory } = context;

    const standards = knowledgeBase.getSafetyStandards();
    
    standards.forEach(standard => {
      // Check if compliance checklist items are addressed
      const lastComplianceCheck = maintenanceHistory.visits.find(v => 
        v.type === 'compliance' || v.type === 'safety_inspection'
      );

      if (!lastComplianceCheck) {
        const daysSinceInstall = elevatorData.installationDate 
          ? Math.floor((Date.now() - new Date(elevatorData.installationDate).getTime()) / (1000 * 60 * 60 * 24))
          : 365;

        if (daysSinceInstall > 365) {
          recommendations.push({
            id: `COMP-${Date.now()}-${standard.standardId.replace(/[^a-zA-Z0-9]/g, '')}`,
            priority: 'high',
            category: 'compliance',
            title: `فحص الامتثال لمعيار ${standard.standardId}`,
            description: `فحص الامتثال لمعيار ${standard.standardId}: ${standard.title}`,
            reasoning: [
              `لم يتم تسجيل فحص امتثال لمعيار ${standard.standardId}`,
              `المعيار يتطلب فحص دوري`,
              `ضمان الامتثال للمعايير المحلية والدولية`
            ],
            confidence: 95,
            dataSources: ['compliance_standards', 'maintenance_history'],
            estimatedDuration: 240,
            requiredSkills: ['certified_inspector'],
            safetyImplications: ['عدم الامتثال القانوني', 'خطر على السلامة'],
            complianceStandards: [standard.standardId],
            learningBased: false
          });
        }
      }
    });

    return recommendations;
  }

  private calculateSummary(recommendations: Recommendation[]): RecommendationResult['summary'] {
    const summary = {
      totalRecommendations: recommendations.length,
      criticalCount: recommendations.filter(r => r.priority === 'critical').length,
      highCount: recommendations.filter(r => r.priority === 'high').length,
      mediumCount: recommendations.filter(r => r.priority === 'medium').length,
      lowCount: recommendations.filter(r => r.priority === 'low').length,
      estimatedTotalCost: recommendations.reduce((sum, r) => sum + (r.estimatedCost || 0), 0),
      estimatedTotalDuration: recommendations.reduce((sum, r) => sum + (r.estimatedDuration || 0), 0)
    };
    return summary;
  }

  private assessDataQuality(context: RecommendationContext): RecommendationResult['dataQuality'] {
    const { elevatorData, maintenanceHistory } = context;

    const elevatorDataCompleteness = this.calculateCompleteness(elevatorData);
    const maintenanceHistoryDepth = Math.min(maintenanceHistory.visits.length / 10, 1);
    const knowledgeBaseCoverage = this.assessKnowledgeCoverage(elevatorData);
    const overallQuality = (elevatorDataCompleteness + maintenanceHistoryDepth + knowledgeBaseCoverage) / 3;

    return {
      elevatorDataCompleteness,
      maintenanceHistoryDepth,
      knowledgeBaseCoverage,
      overallQuality
    };
  }

  private calculateCompleteness(data: any): number {
    const fields = ['manufacturer', 'model', 'controlPanel', 'installationDate', 'lastMaintenanceDate'];
    const filledFields = fields.filter(f => data[f]).length;
    return filledFields / fields.length;
  }

  private assessKnowledgeCoverage(elevatorData: ElevatorData): number {
    let coverage = 0.5; // Base coverage from general knowledge

    if (elevatorData.manufacturer) {
      const guides = knowledgeBase.getManufacturerGuides(elevatorData.manufacturer, elevatorData.model);
      if (guides.length > 0) coverage += 0.2;
    }

    if (elevatorData.controlPanel) {
      const faultCodes = knowledgeBase.getFaultCode(elevatorData.controlPanel, '0001');
      if (faultCodes) coverage += 0.2;
    }

    return Math.min(coverage, 1);
  }

  private estimateDuration(actions: string[]): number {
    // Simple estimation: 30 minutes per action
    return actions.length * 30;
  }

  private determineRequiredSkills(steps: string[]): string[] {
    const skills: string[] = ['general_technician'];
    
    if (steps.some(s => s.toLowerCase().includes('electrical') || s.toLowerCase().includes('circuit'))) {
      skills.push('electrical_technician');
    }
    if (steps.some(s => s.toLowerCase().includes('mechanical') || s.toLowerCase().includes('brake'))) {
      skills.push('mechanical_technician');
    }
    if (steps.some(s => s.toLowerCase().includes('programming') || s.toLowerCase().includes('parameter'))) {
      skills.push('programming_specialist');
    }
    
    return skills;
  }

  private calculateSuccessRate(patterns: any, faultCode: string): number {
    const successfulActions = patterns.successfulActions.get(`fix-${faultCode}`);
    const failurePatterns = patterns.failurePatterns.get(`fix-${faultCode}`);
    
    if (!successfulActions && !failurePatterns) return 0;
    
    const total = (successfulActions || 0) + (failurePatterns || 0);
    return total > 0 ? ((successfulActions || 0) / total) * 100 : 0;
  }

  // Record recommendation outcome for learning
  recordRecommendationOutcome(recommendationId: string, outcome: 'success' | 'partial' | 'failure', feedback?: string): void {
    // This would be integrated with the knowledge base learning system
    console.log(`Recording outcome for recommendation ${recommendationId}: ${outcome}`, feedback);
  }
}

// Singleton instance
const recommendationEngine = new RecommendationEngine();

export { RecommendationEngine, recommendationEngine };
export type {
  ElevatorData,
  MaintenanceHistory,
  RecommendationContext,
  Recommendation,
  RecommendationResult
};
