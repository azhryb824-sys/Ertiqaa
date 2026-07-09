// Comprehensive Elevator Knowledge Base System
// This module manages engineering knowledge, manufacturer data, and best practices

interface ManufacturerGuide {
  id: string;
  manufacturer: string;
  model: string;
  guideType: 'installation' | 'maintenance' | 'operation' | 'troubleshooting';
  title: string;
  content: string;
  version: string;
  lastUpdated: string;
  language: string;
}

interface SparePartCatalog {
  id: string;
  manufacturer: string;
  partNumber: string;
  name: string;
  category: string;
  specifications: Record<string, any>;
  compatibleModels: string[];
  expectedLifespan: number; // in months
  safetyCritical: boolean;
  installationInstructions: string;
  commonFailureModes: string[];
}

interface FaultCode {
  id: string;
  controlPanel: string;
  code: string;
  description: string;
  possibleCauses: string[];
  diagnosticSteps: string[];
  recommendedActions: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  safetyImplications: string[];
}

interface SafetyStandard {
  id: string;
  standardId: string; // e.g., "EN 81", "ASME A17.1"
  title: string;
  category: string;
  requirements: string[];
  inspectionCriteria: string[];
  complianceChecklist: string[];
  lastUpdated: string;
}

interface MaintenanceProcedure {
  id: string;
  procedureType: 'preventive' | 'corrective' | 'emergency';
  component: string;
  frequency: string;
  steps: string[];
  requiredTools: string[];
  safetyPrecautions: string[];
  estimatedDuration: number; // in minutes
  skillLevel: 'basic' | 'intermediate' | 'advanced';
}

interface EnvironmentalFactor {
  factor: 'temperature' | 'humidity' | 'dust' | 'vibration' | 'corrosion';
  impactDescription: string;
  affectedComponents: string[];
  mitigationStrategies: string[];
  inspectionFrequency: string;
}

interface TechnicalServiceBulletin {
  id: string;
  manufacturer: string;
  bulletinNumber: string;
  issueDate: string;
  affectedModels: string[];
  subject: string;
  description: string;
  requiredActions: string[];
  priority: 'mandatory' | 'recommended' | 'informational';
}

class ElevatorKnowledgeBase {
  private manufacturerGuides: Map<string, ManufacturerGuide[]> = new Map();
  private sparePartCatalogs: Map<string, SparePartCatalog> = new Map();
  private faultCodes: Map<string, FaultCode[]> = new Map();
  private safetyStandards: SafetyStandard[] = [];
  private maintenanceProcedures: Map<string, MaintenanceProcedure[]> = new Map();
  private environmentalFactors: EnvironmentalFactor[] = [];
  private technicalBulletins: Map<string, TechnicalServiceBulletin[]> = new Map();
  private learningData: Map<string, any> = new Map();

  constructor() {
    this.initializeBaseKnowledge();
  }

  private initializeBaseKnowledge(): void {
    // Initialize with core safety standards
    this.safetyStandards = [
      {
        id: 'STD-EN81-1',
        standardId: 'EN 81-1/2',
        title: 'Safety Rules for the Construction and Installation of Lifts',
        category: 'general_safety',
        requirements: [
          'Emergency braking system must be tested annually',
          'Speed governor must be inspected every 6 months',
          'Door interlocks must be tested monthly',
          'Overload protection must be verified quarterly'
        ],
        inspectionCriteria: [
          'Brake system response time within limits',
          'Governor activation speed within specified range',
          'Door contact operation reliable',
          'Load sensor accuracy verified'
        ],
        complianceChecklist: [
          'Brake lining thickness measurement',
          'Governor rope tension check',
          'Door contact cleaning and adjustment',
          'Load cell calibration verification'
        ],
        lastUpdated: '2024-01-01'
      },
      {
        id: 'STD-ASME-A17.1',
        standardId: 'ASME A17.1',
        title: 'Safety Code for Elevators and Escalators',
        category: 'general_safety',
        requirements: [
          'Annual safety inspection required',
          'Monthly door operation tests',
          'Quarterly controller diagnostics',
          'Biannual rope inspection'
        ],
        inspectionCriteria: [
          'All safety devices operational',
          'Emergency communication functional',
          'Lighting levels adequate',
          'Ventilation system working'
        ],
        complianceChecklist: [
          'Safety device functional test',
          'Emergency phone test',
          'Light level measurement',
          'Airflow verification'
        ],
        lastUpdated: '2024-01-01'
      }
    ];

    // Initialize environmental factors
    this.environmentalFactors = [
      {
        factor: 'temperature',
        impactDescription: 'High temperatures can cause controller overheating, motor insulation degradation, and lubricant breakdown',
        affectedComponents: ['controller', 'motor', 'brake', 'lubricants'],
        mitigationStrategies: [
          'Ensure adequate machine room ventilation',
          'Install temperature monitoring',
          'Use high-temperature lubricants',
          'Add cooling fans for controllers'
        ],
        inspectionFrequency: 'monthly'
      },
      {
        factor: 'humidity',
        impactDescription: 'High humidity causes corrosion, electrical short circuits, and component degradation',
        affectedComponents: ['controller', 'electrical_components', 'brake', 'ropes'],
        mitigationStrategies: [
          'Install dehumidifiers in machine room',
          'Apply conformal coating to PCBs',
          'Use corrosion-resistant materials',
          'Regular moisture inspections'
        ],
        inspectionFrequency: 'monthly'
      },
      {
        factor: 'dust',
        impactDescription: 'Dust accumulation causes overheating, sensor malfunctions, and mechanical wear',
        affectedComponents: ['controller', 'sensors', 'brake', 'motor'],
        mitigationStrategies: [
          'Install air filtration systems',
          'Regular cleaning schedules',
          'Sealed enclosures for sensitive components',
          'Positive pressure in machine room'
        ],
        inspectionFrequency: 'weekly'
      }
    ];

    // Initialize common fault codes for popular control panels
    this.initializeFaultCodes();
  }

  private initializeFaultCodes(): void {
    // Otis control panel fault codes
    this.faultCodes.set('otis', [
      {
        id: 'FC-OTIS-001',
        controlPanel: 'Otis',
        code: '0001',
        description: 'Safety circuit open',
        possibleCauses: [
          'Door contact not closed',
          'Safety chain broken',
          'Emergency stop activated',
          'Governor switch tripped'
        ],
        diagnosticSteps: [
          'Check all door contacts',
          'Inspect safety circuit wiring',
          'Verify governor switch status',
          'Test emergency stop button'
        ],
        recommendedActions: [
          'Close all doors properly',
          'Repair or replace faulty contacts',
          'Reset safety circuit',
          'Test governor operation'
        ],
        severity: 'critical',
        safetyImplications: ['Elevator cannot move', 'Passengers may be trapped']
      },
      {
        id: 'FC-OTIS-002',
        controlPanel: 'Otis',
        code: '0002',
        description: 'Motor overtemperature',
        possibleCauses: [
          'Overloaded operation',
          'Poor ventilation',
          'High ambient temperature',
          'Motor winding fault'
        ],
        diagnosticSteps: [
          'Measure motor temperature',
          'Check ventilation system',
          'Verify load conditions',
          'Test motor insulation'
        ],
        recommendedActions: [
          'Reduce load frequency',
          'Improve ventilation',
          'Check motor cooling',
          'Schedule motor inspection'
        ],
        severity: 'high',
        safetyImplications: ['Motor damage risk', 'Potential fire hazard']
      }
    ]);

    // Schindler control panel fault codes
    this.faultCodes.set('schindler', [
      {
        id: 'FC-SCHINDLER-001',
        controlPanel: 'Schindler',
        code: '0077',
        description: 'Door cannot close',
        possibleCauses: [
          'Obstruction in door path',
          'Door motor fault',
          'Door sensor malfunction',
          'Mechanical binding'
        ],
        diagnosticSteps: [
          'Clear any obstructions',
          'Test door motor operation',
          'Check door sensors',
          'Inspect door mechanism'
        ],
        recommendedActions: [
          'Remove obstructions',
          'Test door motor',
          'Calibrate sensors',
          'Lubricate door mechanism'
        ],
        severity: 'medium',
        safetyImplications: ['Service disruption', 'Potential entrapment']
      }
    ]);

    // KONE control panel fault codes
    this.faultCodes.set('kone', [
      {
        id: 'FC-KONE-001',
        controlPanel: 'KONE',
        code: '0001',
        description: 'Car unable to move',
        possibleCauses: [
          'Safety circuit open',
          'Inverter fault',
          'Brake not releasing',
          'Motor fault'
        ],
        diagnosticSteps: [
          'Check safety circuit',
          'Test inverter status',
          'Verify brake release',
          'Inspect motor'
        ],
        recommendedActions: [
          'Reset safety circuit',
          'Check inverter parameters',
          'Test brake operation',
          'Schedule motor inspection'
        ],
        severity: 'critical',
        safetyImplications: ['Complete service outage', 'Passenger entrapment']
      }
    ]);
  }

  // Knowledge Base Management Methods
  addManufacturerGuide(guide: ManufacturerGuide): void {
    const key = `${guide.manufacturer}-${guide.model}`;
    if (!this.manufacturerGuides.has(key)) {
      this.manufacturerGuides.set(key, []);
    }
    this.manufacturerGuides.get(key)!.push(guide);
  }

  addSparePartCatalog(part: SparePartCatalog): void {
    this.sparePartCatalogs.set(part.partNumber, part);
  }

  addFaultCode(code: FaultCode): void {
    const key = code.controlPanel.toLowerCase();
    if (!this.faultCodes.has(key)) {
      this.faultCodes.set(key, []);
    }
    this.faultCodes.get(key)!.push(code);
  }

  addSafetyStandard(standard: SafetyStandard): void {
    this.safetyStandards.push(standard);
  }

  addMaintenanceProcedure(procedure: MaintenanceProcedure): void {
    const key = procedure.component;
    if (!this.maintenanceProcedures.has(key)) {
      this.maintenanceProcedures.set(key, []);
    }
    this.maintenanceProcedures.get(key)!.push(procedure);
  }

  addTechnicalBulletin(bulletin: TechnicalServiceBulletin): void {
    const key = bulletin.manufacturer.toLowerCase();
    if (!this.technicalBulletins.has(key)) {
      this.technicalBulletins.set(key, []);
    }
    this.technicalBulletins.get(key)!.push(bulletin);
  }

  // Query Methods
  getManufacturerGuides(manufacturer: string, model?: string): ManufacturerGuide[] {
    if (model) {
      return this.manufacturerGuides.get(`${manufacturer}-${model}`) || [];
    }
    const results: ManufacturerGuide[] = [];
    for (const [key, guides] of this.manufacturerGuides) {
      if (key.startsWith(manufacturer)) {
        results.push(...guides);
      }
    }
    return results;
  }

  getSparePart(partNumber: string): SparePartCatalog | undefined {
    return this.sparePartCatalogs.get(partNumber);
  }

  getFaultCode(controlPanel: string, code: string): FaultCode | undefined {
    const codes = this.faultCodes.get(controlPanel.toLowerCase()) || [];
    return codes.find(fc => fc.code === code);
  }

  getSafetyStandards(category?: string): SafetyStandard[] {
    if (category) {
      return this.safetyStandards.filter(s => s.category === category);
    }
    return this.safetyStandards;
  }

  getMaintenanceProcedures(component: string): MaintenanceProcedure[] {
    return this.maintenanceProcedures.get(component) || [];
  }

  getEnvironmentalFactors(): EnvironmentalFactor[] {
    return this.environmentalFactors;
  }

  getTechnicalBulletins(manufacturer: string): TechnicalServiceBulletin[] {
    return this.technicalBulletins.get(manufacturer.toLowerCase()) || [];
  }

  // Learning System Methods
  recordMaintenanceOutcome(data: {
    elevatorId: string;
    faultCode?: string;
    recommendedAction: string;
    actualAction: string;
    outcome: 'success' | 'partial' | 'failure';
    timestamp: string;
  }): void {
    const key = `outcome-${data.elevatorId}`;
    if (!this.learningData.has(key)) {
      this.learningData.set(key, []);
    }
    this.learningData.get(key)!.push({
      ...data,
      learnedAt: new Date().toISOString()
    });
  }

  getLearningData(elevatorId: string): any[] {
    return this.learningData.get(`outcome-${elevatorId}`) || [];
  }

  analyzePatterns(elevatorId: string): {
    commonFaults: Map<string, number>;
    successfulActions: Map<string, number>;
    failurePatterns: Map<string, number>;
  } {
    const data = this.getLearningData(elevatorId);
    const commonFaults = new Map<string, number>();
    const successfulActions = new Map<string, number>();
    const failurePatterns = new Map<string, number>();

    data.forEach(record => {
      if (record.faultCode) {
        commonFaults.set(record.faultCode, (commonFaults.get(record.faultCode) || 0) + 1);
      }
      if (record.outcome === 'success') {
        successfulActions.set(record.actualAction, (successfulActions.get(record.actualAction) || 0) + 1);
      } else {
        failurePatterns.set(record.actualAction, (failurePatterns.get(record.actualAction) || 0) + 1);
      }
    });

    return { commonFaults, successfulActions, failurePatterns };
  }

  // Export/Import for persistence
  exportKnowledge(): string {
    return JSON.stringify({
      manufacturerGuides: Array.from(this.manufacturerGuides.entries()),
      sparePartCatalogs: Array.from(this.sparePartCatalogs.entries()),
      faultCodes: Array.from(this.faultCodes.entries()),
      safetyStandards: this.safetyStandards,
      maintenanceProcedures: Array.from(this.maintenanceProcedures.entries()),
      environmentalFactors: this.environmentalFactors,
      technicalBulletins: Array.from(this.technicalBulletins.entries()),
      learningData: Array.from(this.learningData.entries())
    }, null, 2);
  }

  importKnowledge(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.manufacturerGuides = new Map(data.manufacturerGuides || []);
      this.sparePartCatalogs = new Map(data.sparePartCatalogs || []);
      this.faultCodes = new Map(data.faultCodes || []);
      this.safetyStandards = data.safetyStandards || [];
      this.maintenanceProcedures = new Map(data.maintenanceProcedures || []);
      this.environmentalFactors = data.environmentalFactors || [];
      this.technicalBulletins = new Map(data.technicalBulletins || []);
      this.learningData = new Map(data.learningData || []);
    } catch (error) {
      console.error('Failed to import knowledge base:', error);
    }
  }
}

// Singleton instance
const knowledgeBase = new ElevatorKnowledgeBase();

export { ElevatorKnowledgeBase, knowledgeBase };
export type {
  ManufacturerGuide,
  SparePartCatalog,
  FaultCode,
  SafetyStandard,
  MaintenanceProcedure,
  EnvironmentalFactor,
  TechnicalServiceBulletin
};
