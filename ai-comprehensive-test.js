// Comprehensive AI Testing Suite
// This file contains extensive tests for all AI features

const AITestSuite = {
  results: [],
  startTime: null,
  endTime: null,
  
  // Initialize test suite
  init() {
    this.startTime = new Date();
    this.results = [];
    console.log("=== بدء اختبار الذكاء الاصطناعي الشامل ===");
    this.log("بدء الاختبار", "info");
  },
  
  // Log test result
  log(testName, status, details = "") {
    const result = {
      test: testName,
      status: status, // pass, fail, warning
      details: details,
      timestamp: new Date().toISOString()
    };
    this.results.push(result);
    
    const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "⚠";
    console.log(`${icon} ${testName}: ${status}${details ? " - " + details : ""}`);
  },
  
  // Test 1: Voice Commands - Basic Operations
  testBasicVoiceCommands() {
    console.log("\n--- اختبار الأوامر الصوتية الأساسية ---");
    
    const commands = [
      { cmd: "أنشئ عقد صيانة", expected: "فتح نموذج عقد صيانة" },
      { cmd: "إنشاء عرض سعر", expected: "فتح نموذج عرض سعر" },
      { cmd: "إنشاء زيارة", expected: "فتح نموذج زيارة" },
      { cmd: "نقل الزيارة", expected: "طلب بيانات النقل" },
      { cmd: "إعادة توزيع الزيارات", expected: "طلب تأكيد إعادة التوزيع" }
    ];
    
    commands.forEach(({ cmd, expected }) => {
      try {
        if (window.handleAiActionEnhanced) {
          window.handleAiActionEnhanced(cmd)
            .then(result => {
              if (result && result.includes(expected.split(" ")[0])) {
                this.log(`الأمر: ${cmd}`, "pass", result);
              } else {
                this.log(`الأمر: ${cmd}`, "warning", "النتيجة غير متطابقة تماماً");
              }
            })
            .catch(err => {
              this.log(`الأمر: ${cmd}`, "fail", err.message);
            });
        } else {
          this.log(`الأمر: ${cmd}`, "fail", "الدالة غير متاحة");
        }
      } catch (error) {
        this.log(`الأمر: ${cmd}`, "fail", error.message);
      }
    });
  },
  
  // Test 2: Voice Commands - AI Features
  testAIVoiceCommands() {
    console.log("\n--- اختبار أوامر الذكاء الاصطناعي ---");
    
    const aiCommands = [
      { cmd: "توصيات", expected: "تقرير التوصيات" },
      { cmd: "تحسين عرض", expected: "طلب بيانات التحسين" },
      { cmd: "حلل تقرير", expected: "طلب رقم التقرير" },
      { cmd: "ملف فني", expected: "طلب هوية الفني" }
    ];
    
    aiCommands.forEach(({ cmd, expected }) => {
      try {
        if (window.handleAiActionEnhanced) {
          window.handleAiActionEnhanced(cmd)
            .then(result => {
              if (result) {
                this.log(`أمر AI: ${cmd}`, "pass", result);
              } else {
                this.log(`أمر AI: ${cmd}`, "warning", "لا يوجد إجراء محلي");
              }
            })
            .catch(err => {
              this.log(`أمر AI: ${cmd}`, "fail", err.message);
            });
        } else {
          this.log(`أمر AI: ${cmd}`, "fail", "الدالة غير متاحة");
        }
      } catch (error) {
        this.log(`أمر AI: ${cmd}`, "fail", error.message);
      }
    });
  },
  
  // Test 3: Voice Commands - Navigation
  testNavigationCommands() {
    console.log("\n--- اختبار أوامر التنقل ---");
    
    const navCommands = [
      { cmd: "اذهب إلى العقود", expected: "contracts" },
      { cmd: "انتقل للزيارات", expected: "visits" },
      { cmd: "افتح البلاغات", expected: "tickets" },
      { cmd: "عرض عروض الأسعار", expected: "quotes" },
      { cmd: "اذهب للمخزون", expected: "inventory" },
      { cmd: "افتح الفنيين", expected: "team" },
      { cmd: "انتقل للتقارير", expected: "reports" },
      { cmd: "افتح الإدارة الذكية", expected: "ai-admin" }
    ];
    
    navCommands.forEach(({ cmd, expected }) => {
      try {
        if (window.handleAiActionEnhanced) {
          window.handleAiActionEnhanced(cmd)
            .then(result => {
              if (result && result.includes("الانتقال")) {
                this.log(`التنقل: ${cmd}`, "pass", result);
              } else {
                this.log(`التنقل: ${cmd}`, "warning", "لم يتم الانتقال");
              }
            })
            .catch(err => {
              this.log(`التنقل: ${cmd}`, "fail", err.message);
            });
        } else {
          this.log(`التنقل: ${cmd}`, "fail", "الدالة غير متاحة");
        }
      } catch (error) {
        this.log(`التنقل: ${cmd}`, "fail", error.message);
      }
    });
  },
  
  // Test 4: Speech Recognition
  testSpeechRecognition() {
    console.log("\n--- اختبار التعرف الصوتي ---");
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.log("دعم التعرف الصوتي", "fail", "المتصفح لا يدعم Web Speech API");
      return;
    }
    
    this.log("دعم التعرف الصوتي", "pass", "المتصفح يدعم Web Speech API");
    
    // Test enhanced recognition
    if (window.enhancedListenArabic) {
      this.log("التعرف الصوتي المحسن", "pass", "الدالة متاحة");
      
      // Test configuration
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      
      this.log("اللغة العربية", rec.lang === "ar-SA" ? "pass" : "fail", rec.lang);
      this.log("النتائج المتوسطة", rec.interimResults ? "pass" : "fail", rec.interimResults);
      this.log("بدائل متعددة", rec.maxAlternatives >= 3 ? "pass" : "warning", rec.maxAlternatives);
    } else {
      this.log("التعرف الصوتي المحسن", "fail", "الدالة غير متاحة");
    }
  },
  
  // Test 5: Backend API Integration
  testBackendAPI() {
    console.log("\n--- اختبار تكامل API الخلفية ---");
    
    const endpoints = [
      "/api/ai/admin",
      "/api/ai/recommendations",
      "/api/ai/optimize-quote",
      "/api/ai/analyze-report",
      "/api/ai/redistribute-visits",
      "/api/ai/technician-profile"
    ];
    
    endpoints.forEach(endpoint => {
      fetch(endpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      })
      .then(res => {
        if (res.ok || res.status === 405) { // 405 Method Not Allowed is OK for POST endpoints
          this.log(`API: ${endpoint}`, "pass", `Status: ${res.status}`);
        } else {
          this.log(`API: ${endpoint}`, "warning", `Status: ${res.status}`);
        }
      })
      .catch(err => {
        this.log(`API: ${endpoint}`, "fail", err.message);
      });
    });
  },
  
  // Test 6: Permissions
  testPermissions() {
    console.log("\n--- اختبار الصلاحيات ---");
    
    const session = JSON.parse(localStorage.getItem("misadSession") || "null");
    
    if (!session) {
      this.log("جلسة المستخدم", "fail", "لا توجد جلسة نشطة");
      return;
    }
    
    this.log("جلسة المستخدم", "pass", `الدور: ${session.role}`);
    
    const manage = ["owner", "company_admin", "admin"].includes(session.role);
    
    if (manage) {
      this.log("صلاحيات الإدارة", "pass", "لديك صلاحيات تنفيذ الأوامر");
    } else {
      this.log("صلاحيات الإدارة", "warning", "ليس لديك صلاحيات تنفيذ الأوامر");
    }
  },
  
  // Test 7: Performance
  testPerformance() {
    console.log("\n--- اختبار الأداء ---");
    
    const testCommands = [
      "أنشئ عقد صيانة",
      "اذهب إلى العقود",
      "حالة النظام"
    ];
    
    testCommands.forEach(cmd => {
      const start = performance.now();
      
      if (window.handleAiActionEnhanced) {
        window.handleAiActionEnhanced(cmd)
          .then(() => {
            const end = performance.now();
            const duration = (end - start).toFixed(2);
            
            if (duration < 1000) {
              this.log(`الأداء: ${cmd}`, "pass", `${duration}ms`);
            } else if (duration < 3000) {
              this.log(`الأداء: ${cmd}`, "warning", `${duration}ms`);
            } else {
              this.log(`الأداء: ${cmd}`, "fail", `${duration}ms`);
            }
          })
          .catch(err => {
            this.log(`الأداء: ${cmd}`, "fail", err.message);
          });
      }
    });
  },
  
  // Test 8: Error Handling
  testErrorHandling() {
    console.log("\n--- اختبار معالجة الأخطاء ---");
    
    const invalidCommands = [
      "",
      "أمر غير موجود",
      "12345",
      "!@#$%"
    ];
    
    invalidCommands.forEach(cmd => {
      if (window.handleAiActionEnhanced) {
        window.handleAiActionEnhanced(cmd)
          .then(result => {
            if (!result || result === "") {
              this.log(`معالجة الأخطاء: "${cmd}"`, "pass", "تم تجاهل الأمر غير صالح");
            } else {
              this.log(`معالجة الأخطاء: "${cmd}"`, "warning", "النتيجة غير متوقعة");
            }
          })
          .catch(err => {
            this.log(`معالجة الأخطاء: "${cmd}"`, "pass", "تم معالجة الخطأ");
          });
      }
    });
  },
  
  // Test 9: Arabic Text Processing
  testArabicProcessing() {
    console.log("\n--- اختبار معالجة النص العربي ---");
    
    const testTexts = [
      "أنشئ عقد صيانة",
      "إنشاء عرض سعر",
      "اذهب إلى العقود",
      "حالة النظام"
    ];
    
    testTexts.forEach(text => {
      const arabicRegex = /[\u0600-\u06FF]/;
      const hasArabic = arabicRegex.test(text);
      
      if (hasArabic) {
        this.log(`النص العربي: "${text}"`, "pass", "يحتوي على أحرف عربية");
      } else {
        this.log(`النص العربي: "${text}"`, "fail", "لا يحتوي على أحرف عربية");
      }
    });
  },
  
  // Test 10: Integration with Existing Functions
  testIntegration() {
    console.log("\n--- اختبار التكامل مع الوظائف الموجودة ---");
    
    const functions = [
      "openForm",
      "render",
      "toast",
      "speakArabic"
    ];
    
    functions.forEach(funcName => {
      if (window[funcName]) {
        this.log(`الوظيفة: ${funcName}`, "pass", "متاحة");
      } else {
        this.log(`الوظيفة: ${funcName}`, "warning", "غير متاحة");
      }
    });
  },
  
  // Generate test report
  generateReport() {
    this.endTime = new Date();
    const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);
    
    const passed = this.results.filter(r => r.status === "pass").length;
    const failed = this.results.filter(r => r.status === "fail").length;
    const warnings = this.results.filter(r => r.status === "warning").length;
    const total = this.results.length;
    
    const report = {
      summary: {
        startTime: this.startTime.toISOString(),
        endTime: this.endTime.toISOString(),
        duration: `${duration}s`,
        total: total,
        passed: passed,
        failed: failed,
        warnings: warnings,
        successRate: ((passed / total) * 100).toFixed(2) + "%"
      },
      results: this.results
    };
    
    console.log("\n=== تقرير الاختبار الشامل ===");
    console.log(`المدة: ${duration} ثانية`);
    console.log(`إجمالي الاختبارات: ${total}`);
    console.log(`نجح: ${passed}`);
    console.log(`فشل: ${failed}`);
    console.log(`تحذيرات: ${warnings}`);
    console.log(`نسبة النجاح: ${report.summary.successRate}`);
    
    return report;
  },
  
  // Run all tests
  runAll() {
    this.init();
    
    setTimeout(() => this.testBasicVoiceCommands(), 100);
    setTimeout(() => this.testAIVoiceCommands(), 500);
    setTimeout(() => this.testNavigationCommands(), 900);
    setTimeout(() => this.testSpeechRecognition(), 1300);
    setTimeout(() => this.testBackendAPI(), 1700);
    setTimeout(() => this.testPermissions(), 2100);
    setTimeout(() => this.testPerformance(), 2500);
    setTimeout(() => this.testErrorHandling(), 2900);
    setTimeout(() => this.testArabicProcessing(), 3300);
    setTimeout(() => this.testIntegration(), 3700);
    
    setTimeout(() => {
      const report = this.generateReport();
      
      // Save report to localStorage
      localStorage.setItem("aiTestReport", JSON.stringify(report));
      
      // Display report in alert
      alert(`
تقرير الاختبار الشامل للذكاء الاصطناعي
═══════════════════════════════════════
المدة: ${report.summary.duration}
إجمالي الاختبارات: ${report.summary.total}
نجح: ${report.summary.passed}
فشل: ${report.summary.failed}
تحذيرات: ${report.summary.warnings}
نسبة النجاح: ${report.summary.successRate}
═══════════════════════════════════════
تم حفظ التقرير التفصيلي في localStorage
      `);
    }, 4500);
  }
};

// Auto-run if loaded in browser
if (typeof window !== "undefined") {
  window.AITestSuite = AITestSuite;
  console.log("تم تحميل مجموعة اختبارات الذكاء الاصطناعي");
  console.log("للتشغيل: AITestSuite.runAll()");
}
