// Comprehensive Elevator Knowledge Base System
// This module manages engineering knowledge, manufacturer data, and best practices

class ElevatorKnowledgeBase {
  constructor() {
    this.manufacturerGuides = new Map();
    this.sparePartCatalogs = new Map();
    this.faultCodes = new Map();
    this.safetyStandards = [];
    this.maintenanceProcedures = new Map();
    this.environmentalFactors = [];
    this.technicalBulletins = new Map();
    this.learningData = new Map();
    this.initializeBaseKnowledge();
  }

  initializeBaseKnowledge() {
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

  initializeFaultCodes() {
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
  addManufacturerGuide(guide) {
    const key = `${guide.manufacturer}-${guide.model}`;
    if (!this.manufacturerGuides.has(key)) {
      this.manufacturerGuides.set(key, []);
    }
    this.manufacturerGuides.get(key).push(guide);
  }

  addSparePartCatalog(part) {
    this.sparePartCatalogs.set(part.partNumber, part);
  }

  addFaultCode(code) {
    const key = code.controlPanel.toLowerCase();
    if (!this.faultCodes.has(key)) {
      this.faultCodes.set(key, []);
    }
    this.faultCodes.get(key).push(code);
  }

  addSafetyStandard(standard) {
    this.safetyStandards.push(standard);
  }

  addMaintenanceProcedure(procedure) {
    const key = procedure.component;
    if (!this.maintenanceProcedures.has(key)) {
      this.maintenanceProcedures.set(key, []);
    }
    this.maintenanceProcedures.get(key).push(procedure);
  }

  addTechnicalBulletin(bulletin) {
    const key = bulletin.manufacturer.toLowerCase();
    if (!this.technicalBulletins.has(key)) {
      this.technicalBulletins.set(key, []);
    }
    this.technicalBulletins.get(key).push(bulletin);
  }

  // Query Methods
  getManufacturerGuides(manufacturer, model) {
    if (model) {
      return this.manufacturerGuides.get(`${manufacturer}-${model}`) || [];
    }
    const results = [];
    for (const [key, guides] of this.manufacturerGuides) {
      if (key.startsWith(manufacturer)) {
        results.push(...guides);
      }
    }
    return results;
  }

  getSparePart(partNumber) {
    return this.sparePartCatalogs.get(partNumber);
  }

  getFaultCode(controlPanel, code) {
    const codes = this.faultCodes.get(controlPanel.toLowerCase()) || [];
    return codes.find(fc => fc.code === code);
  }

  getSafetyStandards(category) {
    if (category) {
      return this.safetyStandards.filter(s => s.category === category);
    }
    return this.safetyStandards;
  }

  getMaintenanceProcedures(component) {
    return this.maintenanceProcedures.get(component) || [];
  }

  getEnvironmentalFactors() {
    return this.environmentalFactors;
  }

  getTechnicalBulletins(manufacturer) {
    return this.technicalBulletins.get(manufacturer.toLowerCase()) || [];
  }

  // Learning System Methods
  recordMaintenanceOutcome(data) {
    const key = `outcome-${data.elevatorId}`;
    if (!this.learningData.has(key)) {
      this.learningData.set(key, []);
    }
    this.learningData.get(key).push({
      ...data,
      learnedAt: new Date().toISOString()
    });
  }

  getLearningData(elevatorId) {
    return this.learningData.get(`outcome-${elevatorId}`) || [];
  }

  analyzePatterns(elevatorId) {
    const data = this.getLearningData(elevatorId);
    const commonFaults = new Map();
    const successfulActions = new Map();
    const failurePatterns = new Map();

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
  exportKnowledge() {
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

  importKnowledge(jsonData) {
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

module.exports = { ElevatorKnowledgeBase, knowledgeBase };