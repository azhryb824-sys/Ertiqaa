// Voice AI Enhancement Module
// Add this script to dashboard.html after app.js

(function() {
  // Enhanced AI action handler with all new AI features
  window.handleAiActionEnhanced = async function(question) {
    const q = String(question || "").trim();
    const session = JSON.parse(localStorage.getItem("misadSession") || "null");
    if (!session) return "";
    
    const manage = ["owner", "company_admin", "admin"].includes(session.role);
    const wantsAction = /أنشئ|انشئ|إنشاء|عدل|تعديل|انقل|اسند|إسناد|وزع|إعادة توزيع|حلل|تحليل|توليد|إنشاء عرض|تعديل عرض|تحسين عرض|توصيات|تقرير|ملف فني|إضافة|حذف|عرض|افتح|اذهب|انتقل|بحث|ابحث|حالة|إحصائيات|مراجعة|اعتماد/i.test(q);
    
    if (!wantsAction) return "";
    if (!manage) return "لا تملك صلاحية تنفيذ هذا الأمر. يمكنني المساعدة بالشرح فقط.";
    
    // Contract creation
    if (/عقد/.test(q) && /صيانة/.test(q)) {
      if (confirm("سيتم فتح نموذج إنشاء عقد صيانة. هل تريد المتابعة؟")) {
        if (window.openForm) {
          window.openForm("contract");
          const f = document.querySelector("#modalContent form");
          if (f?.type) f.type.value = "صيانة";
          if (window.updateContractTypeFields) window.updateContractTypeFields(f);
        }
        return "تم فتح نموذج إنشاء عقد صيانة. أكمل البيانات ثم احفظ.";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Quote creation
    if (/عرض سعر|عرض/.test(q) && !/تعديل|تحسين/.test(q)) {
      if (confirm("سيتم فتح نموذج إنشاء عرض سعر. هل تريد المتابعة؟")) {
        if (window.openForm) window.openForm("quote");
        return "تم فتح نموذج إنشاء عرض سعر. أكمل البيانات ثم احفظ.";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Visit creation
    if (/زيارة/.test(q) && !/انقل|اسند|إسناد|وزع/.test(q)) {
      if (confirm("سيتم فتح نموذج إنشاء زيارة كشفية. هل تريد المتابعة؟")) {
        if (window.openForm) window.openForm("visit");
        return "تم فتح نموذج إنشاء زيارة. أكمل البيانات ثم احفظ.";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Visit redistribution with AI
    if (/وزع|إعادة توزيع/.test(q) && /زيارة/.test(q)) {
      if (confirm("سيتم إعادة توزيع الزيارات بناءً على التحليل الجغرافي وتوزيع عبء العمل. هل تريد المتابعة؟")) {
        fetch("/api/ai/redistribute-visits", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({userId: session.id, role: session.role, redistributeAll: true, applyChanges: true})
        })
        .then(r => r.json())
        .then(d => {
          if (d.appliedChanges?.length) {
            if (window.toast) window.toast(`تم إعادة توزيع ${d.appliedChanges.length} زيارة`);
            if (window.render) window.render("visits");
          } else {
            if (window.toast) window.toast("لم يتم العثور على زيارات لإعادة توزيعها");
          }
        })
        .catch(e => {
          if (window.toast) window.toast("تعذر إعادة توزيع الزيارات: " + e.message);
        });
        return "جاري إعادة توزيع الزيارات...";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Generate recommendations report
    if (/توصيات|تقرير/.test(q) && !/تقرير زيارة|تقرير فني/i.test(q)) {
      if (confirm("سيتم إنشاء تقرير التوصيات الذكي. هل تريد المتابعة؟")) {
        fetch(`/api/ai/recommendations?role=${encodeURIComponent(session.role)}`)
        .then(r => r.json())
        .then(d => {
          const report = d;
          if (report) {
            const summary = report.summary || "تم إنشاء التقرير";
            const findings = report.findings?.map(f => `• ${f.description}`).join("\n") || "";
            const recommendations = report.recommendations?.map(r => `• ${r.description}`).join("\n") || "";
            alert(`${summary}\n\nالملاحظات:\n${findings}\n\nالتوصيات:\n${recommendations}`);
            if (window.toast) window.toast("تم إنشاء تقرير التوصيات");
          } else {
            if (window.toast) window.toast("تعذر إنشاء التقرير");
          }
        })
        .catch(e => {
          if (window.toast) window.toast("تعذر إنشاء التقرير: " + e.message);
        });
        return "جاري إنشاء تقرير التوصيات...";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Optimize quote
    if (/تحسين عرض|تعديل عرض/.test(q)) {
      const quoteId = prompt("أدخل رقم عرض السعر المراد تحسينه:");
      if (!quoteId) return "تم إلغاء التنفيذ.";
      const targetValue = prompt("أدخل القيمة المستهدفة للعرض:");
      if (!targetValue) return "تم إلغاء التنفيذ.";
      if (confirm("سيتم تحسين عرض السعر بناءً على بيانات الموردين. هل تريد المتابعة؟")) {
        fetch("/api/ai/optimize-quote", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            quoteId,
            targetValue: Number(targetValue),
            userId: session.id,
            role: session.role,
            applyChanges: true
          })
        })
        .then(r => r.json())
        .then(d => {
          if (d.newQuote) {
            if (window.toast) window.toast("تم تحسين عرض السعر وإنشاء إصدار جديد");
            if (window.render) window.render("quotes");
          } else {
            if (window.toast) window.toast("تعذر تحسين عرض السعر");
          }
        })
        .catch(e => {
          if (window.toast) window.toast("تعذر تحسين عرض السعر: " + e.message);
        });
        return "جاري تحسين عرض السعر...";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Analyze report and generate quote
    if (/حلل تقرير|تحليل تقرير/.test(q)) {
      const reportId = prompt("أدخل رقم التقرير المراد تحليله:");
      if (!reportId) return "تم إلغاء التنفيذ.";
      if (confirm("سيتم تحليل التقرير وتوليد عرض سعر تلقائياً. هل تريد المتابعة؟")) {
        fetch("/api/ai/analyze-report", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            reportId,
            autoGenerateQuote: true,
            userId: session.id,
            role: session.role
          })
        })
        .then(r => r.json())
        .then(d => {
          if (d.quote) {
            if (window.toast) window.toast("تم تحليل التقرير وتوليد عرض سعر");
            if (window.render) window.render("quotes");
          } else {
            if (window.toast) window.toast("تعذر تحليل التقرير");
          }
        })
        .catch(e => {
          if (window.toast) window.toast("تعذر تحليل التقرير: " + e.message);
        });
        return "جاري تحليل التقرير...";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Technician profile
    if (/ملف فني|ملف مهني/i.test(q)) {
      const technicianId = prompt("أدخل هوية الفني:");
      if (!technicianId) return "تم إلغاء التنفيذ.";
      if (confirm("سيتم إنشاء الملف المهني للفني. هل تريد المتابعة؟")) {
        fetch(`/api/ai/technician-profile?technicianId=${encodeURIComponent(technicianId)}&role=${encodeURIComponent(session.role)}`)
        .then(r => r.json())
        .then(d => {
          if (d.technicianName) {
            const profile = d;
            const summary = `الاسم: ${profile.technicianName}\nالدور: ${profile.role}\nمعدل الإنجاز: ${profile.performance?.completionRate}%\nتقييم العملاء: ${profile.performance?.customerRating}/5\nالمهارات: ${profile.skills?.join(", ") || "غير محدد"}`;
            alert(summary);
            if (window.toast) window.toast("تم إنشاء الملف المهني");
          } else {
            if (window.toast) window.toast("تعذر إنشاء الملف المهني");
          }
        })
        .catch(e => {
          if (window.toast) window.toast("تعذر إنشاء الملف المهني: " + e.message);
        });
        return "جاري إنشاء الملف المهني...";
      }
      return "تم إلغاء التنفيذ.";
    }
    
    // Navigate to pages
    if (/اذهب|انتقل|افتح|عرض/i.test(q)) {
      if (/العقود|عقد/i.test(q)) {
        if (window.render) window.render("contracts");
        return "تم الانتقال إلى صفحة العقود.";
      }
      if (/الزيارات|زيارة/i.test(q)) {
        if (window.render) window.render("visits");
        return "تم الانتقال إلى صفحة الزيارات.";
      }
      if (/البلاغات|بلاغ/i.test(q)) {
        if (window.render) window.render("tickets");
        return "تم الانتقال إلى صفحة البلاغات.";
      }
      if (/عروض الأسعار|عرض سعر/i.test(q)) {
        if (window.render) window.render("quotes");
        return "تم الانتقال إلى صفحة عروض الأسعار.";
      }
      if (/المخزون|قطع الغيار/i.test(q)) {
        if (window.render) window.render("inventory");
        return "تم الانتقال إلى صفحة المخزون.";
      }
      if (/الفنيين|الفريق/i.test(q)) {
        if (window.render) window.render("team");
        return "تم الانتقال إلى صفحة الفريق.";
      }
      if (/التقارير/i.test(q)) {
        if (window.render) window.render("reports");
        return "تم الانتقال إلى صفحة التقارير.";
      }
      if (/الإدارة الذكية|الذكاء الاصطناعي/i.test(q)) {
        if (window.render) window.render("ai-admin");
        return "تم الانتقال إلى صفحة الإدارة الذكية.";
      }
    }
    
    // Search functionality
    if (/بحث|ابحث/i.test(q)) {
      const searchTerm = q.replace(/بحث|ابحث|عن|في/gi, "").trim();
      if (searchTerm) {
        const searchInput = document.querySelector(".search input");
        if (searchInput) {
          searchInput.value = searchTerm;
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          return `جاري البحث عن: ${searchTerm}`;
        }
      }
      return "الرجاء تحديد ما تريد البحث عنه.";
    }
    
    // Statistics and overview
    if (/حالة|إحصائيات|نظرة عامة/i.test(q)) {
      if (window.render) window.render("overview");
      return "تم عرض النظرة العامة والإحصائيات.";
    }
    
    // Approve documents
    if (/اعتماد|موافقة/i.test(q)) {
      if (/تقرير/i.test(q)) {
        const reportId = prompt("أدخل رقم التقرير للاعتماد:");
        if (!reportId) return "تم إلغاء التنفيذ.";
        if (confirm("سيتم اعتماد التقرير. هل تريد المتابعة؟")) {
          fetch("/api/documents/approve", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              documentId: reportId,
              userId: session.id,
              role: session.role
            })
          })
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              if (window.toast) window.toast("تم اعتماد التقرير بنجاح");
              if (window.render) window.render("reports");
            } else {
              if (window.toast) window.toast("تعذر اعتماد التقرير");
            }
          })
          .catch(e => {
            if (window.toast) window.toast("تعذر اعتماد التقرير: " + e.message);
          });
          return "جاري اعتماد التقرير...";
        }
        return "تم إلغاء التنفيذ.";
      }
    }
    
    // Review operations
    if (/مراجعة/i.test(q)) {
      if (/الزيارات/i.test(q)) {
        if (window.render) window.render("visits");
        return "تم الانتقال لمراجعة الزيارات.";
      }
      if (/العقود/i.test(q)) {
        if (window.render) window.render("contracts");
        return "تم الانتقال لمراجعة العقود.";
      }
    }
    
    return "";
  };
  
  // Enhanced speech recognition with better accuracy
  window.enhancedListenArabic = function(onText, onStatus) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (onStatus) onStatus("المتصفح لا يدعم التعرف الصوتي");
      return null;
    }
    
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.interimResults = true; // Enable interim results for better feedback
    rec.continuous = false;
    rec.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    
    rec.onstart = () => {
      if (onStatus) onStatus("جاري الاستماع...");
    };
    
    rec.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (onStatus) onStatus("خطأ في التعرف الصوتي: " + event.error);
    };
    
    rec.onend = () => {
      if (onStatus) onStatus("جاهز للاستماع");
    };
    
    rec.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        // Clean up the transcript
        const cleaned = finalTranscript
          .replace(/[^\u0600-\u06FF\s]/g, "") // Keep only Arabic characters and spaces
          .replace(/\s+/g, " ") // Normalize spaces
          .trim();
        
        if (cleaned) onText(cleaned);
      } else if (interimTranscript && onStatus) {
        onStatus("جاري الاستماع: " + interimTranscript);
      }
    };
    
    rec.start();
    return rec;
  };
  
  // Override the existing voice assistant to use enhanced handler
  document.addEventListener("DOMContentLoaded", function() {
    // Wait for the voice dock to be created
    const checkAndEnhance = setInterval(() => {
      const dock = document.getElementById("voiceAiDock");
      if (dock) {
        clearInterval(checkAndEnhance);
        
        // Find the listen button and enhance it with better recognition
        const listenBtn = dock.querySelector("[data-voice-listen]");
        if (listenBtn) {
          const originalHandler = listenBtn.onclick;
          listenBtn.onclick = () => {
            const input = dock.querySelector(".voice-ai-input");
            const log = dock.querySelector(".voice-ai-log");
            
            window.enhancedListenArabic(
              text => {
                input.value = text;
                dock.querySelector("[data-voice-send]").click();
              },
              status => {
                if (status) {
                  const add = (who, text) => {
                    log.insertAdjacentHTML("beforeend", `<article><b>${who}</b><p>${text}</p></article>`);
                    log.scrollTop = log.scrollHeight;
                  };
                  add("النظام", status);
                }
              }
            );
          };
        }
        
        // Find the send button and enhance it
        const sendBtn = dock.querySelector("[data-voice-send]");
        if (sendBtn) {
          const originalHandler = sendBtn.onclick;
          sendBtn.onclick = async function() {
            const input = dock.querySelector(".voice-ai-input");
            const log = dock.querySelector(".voice-ai-log");
            const q = input.value.trim();
            if (!q) return;
            
            const session = JSON.parse(localStorage.getItem("misadSession") || "null");
            const add = (who, text) => {
              log.insertAdjacentHTML("beforeend", `<article><b>${who}</b><p>${text}</p></article>`);
              log.scrollTop = log.scrollHeight;
            };
            
            add(session.name || "المستخدم", q);
            input.value = "";
            
            try {
              add("النظام", "جاري المعالجة...");
              
              // Try enhanced action handler first
              const local = await window.handleAiActionEnhanced(q);
              if (local) {
                log.lastElementChild?.remove();
                add("النظام", local);
                
                // Speak the response
                if (window.speakArabic) {
                  window.speakArabic(local);
                }
                return;
              }
              
              // Fall back to original handler
              if (originalHandler) {
                await originalHandler.call(this);
              }
            } catch (err) {
              log.lastElementChild?.remove();
              add("النظام", err.message || "حدث خطأ");
            }
          };
        }
      }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkAndEnhance), 10000);
  });
  
  console.log("Voice AI Enhancement Module Loaded with Enhanced Recognition");
})();
