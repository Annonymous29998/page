(function () {
  "use strict";

  var HERO_CAPTIONS = [
    "Youth baseball & teamwork",
    "The field & community",
    "Research that saves lives",
  ];
  var HERO_INTERVAL_MS = 6500;
  var HERO_SWIPE_MIN_PX = 48;
  var MIN_DONATION_USD = 100;

  /* FormSubmit: confirm the activation email the first time a submission arrives. */
  var DONATION_FORM_ENDPOINT =
    "https://formsubmit.co/ajax/enduringlegacygrowthfund@gmail.com";
  /* US WhatsApp: +1 (730) 274-4602 → digits only for wa.me */
  var WHATSAPP_ADMIN_NUMBER = "17302744602";

  var pendingDonorName = "";
  var pendingDonorEmail = "";
  var pendingDonorAmountFormatted = "";

  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var navPanel = document.getElementById("nav-panel");
  var donateForm = document.getElementById("donate-form");
  var formMessage = document.getElementById("form-message");
  var customWrap = document.getElementById("custom-amount-wrap");
  var customInput = document.getElementById("custom-amount");
  var paymentDialog = document.getElementById("payment-dialog");
  var paymentDialogAmount = document.getElementById("payment-dialog-amount");
  var paymentDialogClose = document.getElementById("payment-dialog-close");

  var PAYMENT_LABELS = {
    debit: "Debit card",
    chime: "Chime",
    applepay: "Apple Pay",
    etransfer: "e-Transfer",
    bank: "Bank transfer",
  };

  function setMobileNav(open) {
    if (!navToggle || !navPanel) return;
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      navPanel.removeAttribute("hidden");
      header.classList.add("is-open");
    } else {
      navPanel.setAttribute("hidden", "");
      header.classList.remove("is-open");
    }
  }

  if (navToggle && navPanel) {
    navToggle.addEventListener("click", function () {
      var expanded = navToggle.getAttribute("aria-expanded") === "true";
      setMobileNav(!expanded);
    });

    navPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMobileNav(false);
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) {
        setMobileNav(false);
      }
    });
  }

  function syncCustomAmount() {
    if (!customWrap || !customInput) return;
    var selected = document.querySelector('input[name="amount"]:checked');
    var isCustom = selected && selected.value === "custom";
    customWrap.hidden = !isCustom;
    if (isCustom) {
      customInput.required = true;
      customInput.focus();
    } else {
      customInput.required = false;
    }
  }

  document.querySelectorAll('input[name="amount"]').forEach(function (radio) {
    radio.addEventListener("change", syncCustomAmount);
  });
  syncCustomAmount();

  function getSelectedDonationAmountValue() {
    if (!donateForm) return null;
    var amountRadios = donateForm.querySelectorAll('input[name="amount"]');
    var selectedAmount = "";
    amountRadios.forEach(function (r) {
      if (r.checked) selectedAmount = r.value;
    });
    if (selectedAmount === "custom") {
      var n = parseFloat(customInput.value, 10);
      return isNaN(n) ? null : n;
    }
    var preset = parseFloat(selectedAmount, 10);
    return isNaN(preset) ? null : preset;
  }

  function formatMoney(n) {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function buildDonationEmailMessage(name, email, amountFormatted, paymentMethodLabel) {
    return (
      "New donation — Enduring Legacy Growth Fund\r\n\r\n" +
      "Name: " +
      name +
      "\r\n" +
      "Email: " +
      email +
      "\r\n" +
      "Amount: " +
      amountFormatted +
      "\r\n" +
      "Payment method: " +
      paymentMethodLabel +
      "\r\n\r\n" +
      "The donor is following up on WhatsApp to complete payment."
    );
  }

  function setPaymentDialogBusy(loading) {
    if (!paymentDialog) return;
    paymentDialog.setAttribute("aria-busy", loading ? "true" : "false");
    paymentDialog.querySelectorAll(".payment-method-btn").forEach(function (b) {
      b.disabled = loading;
    });
    if (paymentDialogClose) {
      paymentDialogClose.disabled = loading;
    }
  }

  function sendDonationNotification(nameStr, emailStr, amountFormatted, paymentMethodLabel) {
    if (!DONATION_FORM_ENDPOINT || !DONATION_FORM_ENDPOINT.trim()) {
      return Promise.reject(new Error("missing_endpoint"));
    }

    var payload = {
      _subject:
        "Donation — " +
        paymentMethodLabel +
        " — " +
        amountFormatted +
        " — Enduring Legacy Growth Fund",
      name: nameStr,
      email: emailStr,
      message: buildDonationEmailMessage(
        nameStr,
        emailStr,
        amountFormatted,
        paymentMethodLabel
      ),
      payment_method: paymentMethodLabel,
    };
    if (DONATION_FORM_ENDPOINT.indexOf("formsubmit.co") !== -1) {
      payload._captcha = false;
    }

    return fetch(DONATION_FORM_ENDPOINT.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) {
        throw new Error("notify_failed");
      }
      return res;
    });
  }

  function openWhatsAppWithDonation() {
    var num = (WHATSAPP_ADMIN_NUMBER || "").replace(/\D/g, "");
    var msg =
      "Hello — I’d like to make a donation of " +
      pendingDonorAmountFormatted +
      " for the Enduring Legacy Growth Fund.\r\n\r\n";

    var url;
    if (num.length >= 8) {
      url = "https://wa.me/" + num + "?text=" + encodeURIComponent(msg);
    } else {
      url = "https://wa.me/?text=" + encodeURIComponent(msg);
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function clearPendingDonor() {
    pendingDonorName = "";
    pendingDonorEmail = "";
    pendingDonorAmountFormatted = "";
  }

  function openPaymentDialog(amountNumber) {
    if (!paymentDialog || !paymentDialogAmount) return;
    if (typeof paymentDialog.showModal !== "function") {
      if (formMessage) {
        formMessage.textContent =
          "Your browser doesn’t support payment dialogs. Please try a current version of Chrome, Safari, or Firefox.";
      }
      return;
    }
    paymentDialogAmount.textContent = "Gift amount: " + formatMoney(amountNumber);
    paymentDialog.showModal();
    if (paymentDialogClose) {
      paymentDialogClose.focus();
    }
  }

  function closePaymentDialog() {
    if (paymentDialog && typeof paymentDialog.close === "function") {
      paymentDialog.close();
    }
  }

  if (paymentDialog) {
    paymentDialog.addEventListener("click", function (e) {
      if (e.target === paymentDialog) {
        closePaymentDialog();
      }
    });

  }

  if (paymentDialogClose) {
    paymentDialogClose.addEventListener("click", closePaymentDialog);
  }

  if (paymentDialog) {
    paymentDialog.querySelectorAll(".payment-method-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var method = btn.getAttribute("data-method");
        var label = PAYMENT_LABELS[method] || method;

        if (
          !pendingDonorName ||
          !pendingDonorEmail ||
          !pendingDonorAmountFormatted
        ) {
          if (formMessage) {
            formMessage.textContent =
              "Something went wrong. Please close the window and submit the form again.";
          }
          return;
        }

        if (!DONATION_FORM_ENDPOINT || !DONATION_FORM_ENDPOINT.trim()) {
          if (formMessage) {
            formMessage.textContent =
              "Online donations are not available at the moment. Please try again later or contact the organizer.";
          }
          return;
        }

        setPaymentDialogBusy(true);

        sendDonationNotification(
          pendingDonorName,
          pendingDonorEmail,
          pendingDonorAmountFormatted,
          label
        )
          .then(function () {
            closePaymentDialog();
            openWhatsAppWithDonation();
            if (formMessage) {
              formMessage.textContent =
                "Details sent. Opening WhatsApp to complete your gift.";
            }
            if (donateForm) {
              donateForm.reset();
              var defaultRadio = donateForm.querySelector(
                'input[name="amount"][value="100"]'
              );
              if (defaultRadio) defaultRadio.checked = true;
              syncCustomAmount();
            }
            clearPendingDonor();
          })
          .catch(function () {
            if (formMessage) {
              formMessage.textContent =
                "We couldn’t send your details. Check your connection and tap your payment method again.";
            }
          })
          .then(function () {
            setPaymentDialogBusy(false);
          });
      });
    });
  }

  if (donateForm) {
    donateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = donateForm.querySelector("#donor-name");
      var email = donateForm.querySelector("#donor-email");
      var amountRadios = donateForm.querySelectorAll('input[name="amount"]');
      var selectedAmount = "";
      amountRadios.forEach(function (r) {
        if (r.checked) selectedAmount = r.value;
      });

      if (formMessage) {
        formMessage.textContent = "";
      }

      if (!name.value.trim() || !email.value.trim()) {
        if (formMessage) {
          formMessage.textContent = "Please fill in your name and email.";
        }
        return;
      }

      if (selectedAmount === "custom") {
        var n = parseFloat(customInput.value, 10);
        if (!n || n < MIN_DONATION_USD) {
          if (formMessage) {
            formMessage.textContent =
              "Enter a custom amount of at least $" + MIN_DONATION_USD + ".";
          }
          return;
        }
      } else {
        var preset = parseFloat(selectedAmount, 10);
        if (!isNaN(preset) && preset < MIN_DONATION_USD) {
          if (formMessage) {
            formMessage.textContent = "Please choose an amount of at least $" + MIN_DONATION_USD + ".";
          }
          return;
        }
      }

      var amountValue = getSelectedDonationAmountValue();
      if (amountValue === null || amountValue < MIN_DONATION_USD) {
        if (formMessage) {
          formMessage.textContent = "Please enter a valid donation amount.";
        }
        return;
      }

      var nameStr = name.value.trim();
      var emailStr = email.value.trim();
      var amountFormatted = formatMoney(amountValue);

      pendingDonorName = nameStr;
      pendingDonorEmail = emailStr;
      pendingDonorAmountFormatted = amountFormatted;
      openPaymentDialog(amountValue);
      if (formMessage) {
        formMessage.textContent = "Choose how you’d like to pay. Your details will be sent after you pick a method.";
      }
    });
  }

  var prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReduced) {
    var revealEls = document.querySelectorAll(".reveal");
    if (revealEls.length && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
      );
      revealEls.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* --- Hero slides + header over hero --- */
  var heroSection = document.getElementById("hero");
  var heroSlides = document.querySelectorAll(".hero-slide");
  var heroDots = document.querySelectorAll(".hero-dot");
  var heroCaption = document.getElementById("hero-caption");
  var heroTimer = null;
  var heroIndex = 0;
  var motionOk =
    typeof window.matchMedia !== "function" ||
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setHeroSlide(index) {
    if (!heroSlides.length) return;
    var n = heroSlides.length;
    heroIndex = ((index % n) + n) % n;

    heroSlides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === heroIndex);
    });

    heroDots.forEach(function (dot, i) {
      var active = i === heroIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });

    if (heroCaption && HERO_CAPTIONS[heroIndex]) {
      heroCaption.textContent = HERO_CAPTIONS[heroIndex];
    }
  }

  function clearHeroTimer() {
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }

  function startHeroTimer() {
    clearHeroTimer();
    if (!motionOk || heroSlides.length <= 1) return;
    heroTimer = window.setInterval(function () {
      setHeroSlide(heroIndex + 1);
    }, HERO_INTERVAL_MS);
  }

  function restartHeroTimerIfAuto() {
    if (motionOk) {
      clearHeroTimer();
      startHeroTimer();
    }
  }

  function heroTargetIsInteractive(target) {
    if (!target || !target.closest) return false;
    return !!target.closest("a, button, input, select, textarea, label");
  }

  if (heroSlides.length) {
    heroDots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        var to = parseInt(dot.getAttribute("data-slide-to"), 10);
        if (!isNaN(to)) {
          setHeroSlide(to);
          restartHeroTimerIfAuto();
        }
      });
    });

    /* Swipe / drag: left = next, right = previous (also works with mouse on desktop) */
    var swipeStartX = null;
    var swipeStartY = null;
    var swipePointerId = null;

    function onHeroPointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (heroTargetIsInteractive(e.target)) return;
      swipePointerId = e.pointerId;
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
      try {
        if (heroSection && heroSection.setPointerCapture) {
          heroSection.setPointerCapture(e.pointerId);
        }
      } catch (err) {
        /* ignore */
      }
    }

    function onHeroPointerUp(e) {
      if (swipePointerId === null || e.pointerId !== swipePointerId) return;
      try {
        if (heroSection && heroSection.releasePointerCapture) {
          heroSection.releasePointerCapture(e.pointerId);
        }
      } catch (err2) {
        /* ignore */
      }

      var x0 = swipeStartX;
      var y0 = swipeStartY;
      swipePointerId = null;
      swipeStartX = null;
      swipeStartY = null;

      if (x0 === null || y0 === null) return;

      var dx = e.clientX - x0;
      var dy = e.clientY - y0;

      if (Math.abs(dx) < HERO_SWIPE_MIN_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.75) return;

      if (dx < 0) {
        setHeroSlide(heroIndex + 1);
      } else {
        setHeroSlide(heroIndex - 1);
      }
      restartHeroTimerIfAuto();
    }

    function onHeroPointerCancel(e) {
      if (swipePointerId !== null && e.pointerId === swipePointerId) {
        swipePointerId = null;
        swipeStartX = null;
        swipeStartY = null;
      }
    }

    if (heroSection) {
      heroSection.addEventListener("pointerdown", onHeroPointerDown, { passive: true });
      heroSection.addEventListener("pointerup", onHeroPointerUp, { passive: true });
      heroSection.addEventListener("pointercancel", onHeroPointerCancel, { passive: true });
    }

    if (motionOk) {
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          clearHeroTimer();
        } else {
          startHeroTimer();
        }
      });
      startHeroTimer();
    } else {
      setHeroSlide(0);
    }
  }

  if (header && heroSection && "IntersectionObserver" in window) {
    var headerObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          header.classList.toggle("header--hero", entry.isIntersecting);
        });
      },
      { root: null, threshold: 0, rootMargin: "-56px 0px 0px 0px" }
    );
    headerObs.observe(heroSection);
  }

  /* Total raised: data-total-usd on #total-raised; styles are inline in HTML */
  var TOTAL_RAISED_DEFAULT_USD = 10000;
  var totalRaisedSection = document.getElementById("total-raised");
  var totalRaisedNumberEl = document.getElementById("total-raised-number");
  var totalRaisedSubtitleEl = document.getElementById("total-raised-subtitle");
  var totalRaisedRafId = null;

  function formatUsdInteger(num) {
    return Math.max(0, Math.round(Number(num))).toLocaleString("en-US");
  }

  function cancelTotalRaisedAnimation() {
    if (totalRaisedRafId !== null) {
      cancelAnimationFrame(totalRaisedRafId);
      totalRaisedRafId = null;
    }
  }

  function runTotalRaisedCountUp(target) {
    if (!totalRaisedNumberEl) return;
    cancelTotalRaisedAnimation();

    var reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || target <= 0) {
      totalRaisedNumberEl.textContent = formatUsdInteger(target);
      return;
    }

    var duration = 900;
    var startTs = null;

    function frame(ts) {
      if (startTs === null) startTs = ts;
      var t = Math.min((ts - startTs) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = Math.round(target * eased);
      totalRaisedNumberEl.textContent = formatUsdInteger(val);
      if (t < 1) {
        totalRaisedRafId = requestAnimationFrame(frame);
      } else {
        totalRaisedRafId = null;
      }
    }

    totalRaisedNumberEl.textContent = formatUsdInteger(0);
    totalRaisedRafId = requestAnimationFrame(frame);
  }

  function initTotalRaisedFromDom() {
    if (!totalRaisedSection || !totalRaisedNumberEl) return;
    var raw = totalRaisedSection.getAttribute("data-total-usd");
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) n = TOTAL_RAISED_DEFAULT_USD;
    var sub = totalRaisedSection.getAttribute("data-total-subtitle");
    if (totalRaisedSubtitleEl && sub && sub.trim()) {
      totalRaisedSubtitleEl.textContent = sub.trim();
    }

    var reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      totalRaisedNumberEl.textContent = formatUsdInteger(n);
      return;
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              runTotalRaisedCountUp(n);
            } else {
              cancelTotalRaisedAnimation();
              var r = entry.boundingClientRect;
              var vh = window.innerHeight || document.documentElement.clientHeight;
              if (r.bottom < 0 || r.top > vh) {
                totalRaisedNumberEl.textContent = formatUsdInteger(0);
              }
            }
          });
        },
        { threshold: 0, rootMargin: "0px 0px 12% 0px" }
      ).observe(totalRaisedSection);
    } else {
      runTotalRaisedCountUp(n);
    }
  }

  initTotalRaisedFromDom();
})();
