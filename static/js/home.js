/* =============================================================================
   KestrelStrikeAI — 落地页交互（独立自包含，不依赖应用内任何脚本或全局变量）

   模块划分（每个模块都只在对应节点存在时才工作，方便单块删除或复用）：
     01 工具函数        02 主题切换      03 滚动进场      04 攻击链
     05 受控执行演示    06 执行模式标签页    07 终端打字机    08 数字滚动
     09 页脚年份        10 宣传片播放

   动效原则：滚动相关计算一律交给 IntersectionObserver，不做 scroll 事件回调；
   位置测量只在"激活阶段/窗口尺寸变化"这类低频时机发生，且经 requestAnimationFrame 合并。
   ============================================================================= */
(function () {
    'use strict';

    var root = document.documentElement;
    var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    /* ==== 01 工具函数 ==== */
    function prefersReducedMotion() {
        return !!(motionQuery && motionQuery.matches);
    }

    function slice(nodeList) {
        return Array.prototype.slice.call(nodeList);
    }

    function pad(value, width) {
        var text = String(value);
        while (text.length < width) {
            text = '0' + text;
        }
        return text;
    }

    function clock() {
        var now = new Date();
        return pad(now.getHours(), 2) + ':' + pad(now.getMinutes(), 2) + ':' + pad(now.getSeconds(), 2);
    }

    function delay(ms) {
        // 减动效时把"过程感"的等待压到 0：状态机仍然完整跑完，只是不再等
        return prefersReducedMotion() ? 0 : ms;
    }

    /* ==== 02 主题切换 ==== */
    // 三态约定（light / dark / system）与 head 里的引导脚本、控制台 index.html 一致。
    // 点按钮即写入显式值，之后不再跟随系统 —— 这是"用户明确表过态"该有的行为。
    function initTheme() {
        var button = document.getElementById('ksThemeToggle');
        if (!button) {
            return;
        }

        function apply(theme) {
            root.setAttribute('data-theme', theme);
            root.setAttribute('data-theme-preference', theme);
            root.style.colorScheme = theme;
            button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
        }

        function current() {
            return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        }

        apply(current());

        button.addEventListener('click', function () {
            var next = current() === 'dark' ? 'light' : 'dark';
            apply(next);
            try {
                localStorage.setItem('kestrelstrike-theme', next);
            } catch (err) {
                // 隐私模式下 localStorage 可能不可写：本次切换仍然生效，只是不持久
            }
        });

        // 用户从未显式选择过主题时，跟随系统切换
        var schemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        if (!schemeQuery) {
            return;
        }
        var onSchemeChange = function () {
            var stored = null;
            try {
                stored = localStorage.getItem('kestrelstrike-theme');
            } catch (err) {
                stored = null;
            }
            if (stored === 'light' || stored === 'dark') {
                return;
            }
            apply(schemeQuery.matches ? 'dark' : 'light');
        };
        if (schemeQuery.addEventListener) {
            schemeQuery.addEventListener('change', onSchemeChange);
        } else if (schemeQuery.addListener) {
            schemeQuery.addListener(onSchemeChange);
        }
    }

    /* ==== 03 滚动进场 ==== */
    function initReveal() {
        var targets = slice(document.querySelectorAll('[data-ks-reveal]'));
        if (!targets.length) {
            return;
        }

        function showAll() {
            targets.forEach(function (el) {
                el.classList.add('is-visible');
            });
        }

        if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
            showAll();
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                entry.target.classList.add('is-visible');
                // 只进场一次：重复进出视口不该反复播放，避免长页面滚动时一直闪
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

        targets.forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ==== 04 攻击链 ==== */
    function initChain() {
        var chain = document.querySelector('[data-ks-chain]');
        if (!chain) {
            return;
        }
        var nodes = slice(chain.querySelectorAll('[data-ks-stage]'));
        if (!nodes.length) {
            return;
        }

        var stageArea = chain.querySelector('.ks-chain__stage-area');
        var rail = chain.querySelector('.ks-chain__rail');
        var progress = chain.querySelector('[data-ks-chain-progress]');
        var marker = chain.querySelector('[data-ks-chain-marker]');
        var toggle = document.getElementById('ksChainToggle');
        var toggleLabel = document.getElementById('ksChainToggleLabel');
        var panels = nodes.map(function (node) {
            return document.getElementById(node.getAttribute('aria-controls'));
        });

        var activeIndex = 0;
        var autoEnabled = !prefersReducedMotion();
        var interacting = false;
        var inView = true;
        var timer = null;
        var measureFrame = 0;

        function measure() {
            if (!stageArea || !rail || !marker || !progress) {
                return;
            }
            var railRect = rail.getBoundingClientRect();
            var nodeRect = nodes[activeIndex].getBoundingClientRect();
            // 轨道是横是竖由 CSS 决定（窄屏会竖过来）。不复制一份断点常量，
            // 直接看轨道自身的宽高比，布局改了这里不用跟着改。
            var vertical = railRect.height > railRect.width;

            if (vertical) {
                var offsetY = nodeRect.top + nodeRect.height / 2 - railRect.top;
                marker.style.setProperty('--ks-marker-pos', offsetY + 'px');
                progress.style.transform = 'scaleY(' + (railRect.height ? offsetY / railRect.height : 0) + ')';
            } else {
                var offsetX = nodeRect.left + nodeRect.width / 2 - railRect.left;
                marker.style.setProperty('--ks-marker-pos', offsetX + 'px');
                progress.style.transform = 'scaleX(' + (railRect.width ? offsetX / railRect.width : 0) + ')';
            }
        }

        function scheduleMeasure() {
            if (measureFrame) {
                return;
            }
            measureFrame = window.requestAnimationFrame(function () {
                measureFrame = 0;
                measure();
            });
        }

        function activate(index) {
            activeIndex = (index + nodes.length) % nodes.length;
            nodes.forEach(function (node, i) {
                node.classList.toggle('is-active', i === activeIndex);
                node.classList.toggle('is-done', i < activeIndex);
                node.setAttribute('aria-expanded', i === activeIndex ? 'true' : 'false');
                if (panels[i]) {
                    panels[i].classList.toggle('is-active', i === activeIndex);
                }
            });
            measure();
        }

        function syncTimer() {
            // 链滚出视口后停掉定时器：没人看的时候不做无谓的类名写入
            var shouldRun = autoEnabled && !interacting && inView && !document.hidden;
            if (shouldRun && !timer) {
                timer = window.setInterval(function () {
                    activate(activeIndex + 1);
                }, 2600);
            } else if (!shouldRun && timer) {
                window.clearInterval(timer);
                timer = null;
            }
        }

        function syncToggle() {
            if (!toggle) {
                return;
            }
            toggle.setAttribute('aria-pressed', autoEnabled ? 'true' : 'false');
            if (toggleLabel) {
                toggleLabel.textContent = autoEnabled ? '自动推进中' : '自动推进';
            }
        }

        nodes.forEach(function (node, i) {
            node.addEventListener('click', function () {
                activate(i);
            });
            node.addEventListener('keydown', function (event) {
                var step = 0;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    step = 1;
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    step = -1;
                } else if (event.key === 'Home') {
                    nodes[0].focus();
                    activate(0);
                    event.preventDefault();
                    return;
                } else if (event.key === 'End') {
                    nodes[nodes.length - 1].focus();
                    activate(nodes.length - 1);
                    event.preventDefault();
                    return;
                } else {
                    return;
                }
                event.preventDefault();
                var nextIndex = (i + step + nodes.length) % nodes.length;
                nodes[nextIndex].focus();
                activate(nextIndex);
            });
        });

        // 悬停或键盘焦点落在链上时暂停自动推进：用户正在读，别把内容换走
        chain.addEventListener('pointerenter', function () {
            interacting = true;
            syncTimer();
        });
        chain.addEventListener('pointerleave', function () {
            interacting = false;
            syncTimer();
        });
        chain.addEventListener('focusin', function () {
            interacting = true;
            syncTimer();
        });
        chain.addEventListener('focusout', function (event) {
            if (chain.contains(event.relatedTarget)) {
                return;
            }
            interacting = false;
            syncTimer();
        });

        if (toggle) {
            toggle.addEventListener('click', function () {
                autoEnabled = !autoEnabled;
                syncToggle();
                syncTimer();
            });
        }

        document.addEventListener('visibilitychange', syncTimer);
        window.addEventListener('resize', scheduleMeasure);

        if ('IntersectionObserver' in window) {
            var visibilityObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                    syncTimer();
                });
            }, { threshold: 0 });
            visibilityObserver.observe(chain);
        }

        activate(0);
        syncToggle();
        syncTimer();
    }

    /* ==== 05 受控执行演示 ==== */
    // 本地状态机，完全在浏览器里跑：模型提案 → 策略判定 → 人工确认 → 审计留痕。
    // 审计条目按"只追加"表达，重置闸门不会抹掉记录 —— 这本身就是产品的语义。
    function initGate() {
        var gate = document.querySelector('[data-ks-gate]');
        if (!gate) {
            return;
        }
        var radios = slice(gate.querySelectorAll('input[name="ks-scenario"]'));
        if (!radios.length) {
            return;
        }

        var refs = {
            tool: gate.querySelector('[data-ks-proposal-tool]'),
            args: gate.querySelector('[data-ks-proposal-args]'),
            risk: gate.querySelector('[data-ks-proposal-risk]'),
            state: gate.querySelector('[data-ks-gate-state]'),
            stateText: gate.querySelector('[data-ks-gate-state-text]'),
            audit: gate.querySelector('[data-ks-audit]'),
            auditEmpty: gate.querySelector('[data-ks-audit-empty]')
        };
        var stepEls = {};
        slice(gate.querySelectorAll('[data-ks-step]')).forEach(function (el) {
            stepEls[el.getAttribute('data-ks-step')] = el;
        });
        var buttons = {};
        slice(gate.querySelectorAll('[data-ks-action]')).forEach(function (el) {
            buttons[el.getAttribute('data-ks-action')] = el;
        });

        var timers = [];
        var auditSeq = 0;
        var scenario = null;
        var awaiting = null;

        function wait(ms, fn) {
            timers.push(window.setTimeout(fn, ms));
        }

        function clearTimers() {
            timers.forEach(window.clearTimeout);
            timers = [];
        }

        function setState(state, text) {
            refs.state.setAttribute('data-state', state);
            refs.stateText.textContent = text;
        }

        function markStep(key, className) {
            var el = stepEls[key];
            if (!el) {
                return;
            }
            el.classList.remove('is-active', 'is-done', 'is-blocked', 'is-skipped');
            el.classList.add(className);
        }

        function clearSteps() {
            Object.keys(stepEls).forEach(function (key) {
                stepEls[key].classList.remove('is-active', 'is-done', 'is-blocked', 'is-skipped');
            });
        }

        function setActions(canSubmit, canDecide) {
            if (buttons.submit) {
                buttons.submit.disabled = !canSubmit;
            }
            if (buttons.approve) {
                buttons.approve.disabled = !canDecide;
            }
            if (buttons.reject) {
                buttons.reject.disabled = !canDecide;
            }
        }

        function readScenario(input) {
            var data = input.dataset;
            return {
                tool: data.ksTool || '未知工具',
                args: data.ksArgs || '{}',
                risk: data.ksRisk || '未知',
                verdict: data.ksVerdict || 'allow',
                basis: data.ksBasis || '',
                operator: data.ksOperator || '策略引擎'
            };
        }

        function renderProposal(item) {
            refs.tool.textContent = item.tool;
            refs.args.textContent = item.args;
            refs.risk.textContent = item.risk;
        }

        function addAudit(entry) {
            auditSeq += 1;
            var chipClass = entry.verdict === 'deny' ? 'ks-risk--block' : entry.verdict === 'hitl' ? 'ks-risk--high' : 'ks-risk--low';

            var item = document.createElement('li');
            item.className = 'ks-audit__item';
            item.setAttribute('data-verdict', entry.verdict);

            var head = document.createElement('div');
            head.className = 'ks-audit__head';

            var tool = document.createElement('span');
            tool.className = 'ks-audit__tool';
            tool.textContent = entry.tool;

            var chip = document.createElement('span');
            chip.className = 'ks-risk ' + chipClass;
            chip.textContent = entry.decisionLabel;

            head.appendChild(tool);
            head.appendChild(chip);

            var meta = document.createElement('p');
            meta.className = 'ks-audit__meta';
            meta.textContent = 'AUD-' + pad(auditSeq, 4) + ' · ' + clock() + ' · operator: ' + entry.operator;

            var basis = document.createElement('p');
            basis.className = 'ks-audit__basis';
            basis.textContent = entry.basis;

            item.appendChild(head);
            item.appendChild(meta);
            item.appendChild(basis);
            refs.audit.appendChild(item);

            if (refs.auditEmpty) {
                refs.auditEmpty.hidden = true;
            }
            // 直接滚到底，而不是 scrollIntoView：后者可能把整页也一起带走
            refs.audit.scrollTop = refs.audit.scrollHeight;
        }

        function resetGate() {
            clearTimers();
            awaiting = null;
            clearSteps();
            setState('idle', '等待提交');
            setActions(true, false);
        }

        function submit() {
            if (!scenario) {
                return;
            }
            clearTimers();
            awaiting = null;
            clearSteps();
            setActions(false, false);
            markStep('propose', 'is-done');
            markStep('policy', 'is-active');
            setState('running', '策略判定中…');

            wait(delay(520), function () {
                if (scenario.verdict === 'allow') {
                    markStep('policy', 'is-done');
                    markStep('hitl', 'is-skipped');
                    markStep('decision', 'is-done');
                    markStep('audit', 'is-done');
                    setState('allowed', '已放行 · 策略未命中，风险 ' + scenario.risk);
                    addAudit({
                        verdict: 'allow',
                        decisionLabel: '放行',
                        tool: scenario.tool,
                        operator: scenario.operator,
                        basis: scenario.basis + '；风险等级 ' + scenario.risk
                    });
                    setActions(true, false);
                    return;
                }

                if (scenario.verdict === 'hitl') {
                    markStep('policy', 'is-done');
                    markStep('hitl', 'is-active');
                    setState('awaiting', '高风险动作 · 等待人工确认');
                    awaiting = scenario;
                    setActions(false, true);
                    return;
                }

                markStep('policy', 'is-blocked');
                markStep('hitl', 'is-skipped');
                markStep('decision', 'is-blocked');
                markStep('audit', 'is-done');
                setState('blocked', '已拦截 · ' + scenario.basis);
                addAudit({
                    verdict: 'deny',
                    decisionLabel: '拦截',
                    tool: scenario.tool,
                    operator: scenario.operator,
                    basis: scenario.basis + '（目标越界，未执行）'
                });
                setActions(true, false);
            });
        }

        function decide(approved) {
            if (!awaiting) {
                return;
            }
            var item = awaiting;
            awaiting = null;
            clearTimers();
            setActions(false, false);

            wait(delay(360), function () {
                if (approved) {
                    markStep('hitl', 'is-done');
                    markStep('decision', 'is-done');
                    markStep('audit', 'is-done');
                    setState('allowed', '已放行 · 人工确认后执行');
                    addAudit({
                        verdict: 'hitl',
                        decisionLabel: '人工放行',
                        tool: item.tool,
                        operator: 'sec-lead（人工确认）',
                        basis: item.basis + '；确认人已复核目标与授权范围'
                    });
                } else {
                    markStep('hitl', 'is-done');
                    markStep('decision', 'is-blocked');
                    markStep('audit', 'is-done');
                    setState('blocked', '已拒绝 · 人工否决该动作');
                    addAudit({
                        verdict: 'deny',
                        decisionLabel: '人工拒绝',
                        tool: item.tool,
                        operator: 'sec-lead（人工确认）',
                        basis: '确认人否决：授权依据不足，动作未执行'
                    });
                }
                setActions(true, false);
            });
        }

        function selectScenario(input, resetFlow) {
            scenario = readScenario(input);
            radios.forEach(function (radio) {
                var label = radio.closest('.ks-scenario');
                if (label) {
                    // :has() 在旧浏览器上不可用，这里同时维护类名，样式只依赖其中一个即可
                    label.classList.toggle('is-selected', radio === input);
                }
            });
            renderProposal(scenario);
            if (resetFlow) {
                resetGate();
            }
        }

        radios.forEach(function (radio) {
            radio.addEventListener('change', function () {
                if (radio.checked) {
                    selectScenario(radio, true);
                }
            });
        });

        if (buttons.submit) {
            buttons.submit.addEventListener('click', submit);
        }
        if (buttons.approve) {
            buttons.approve.addEventListener('click', function () {
                decide(true);
            });
        }
        if (buttons.reject) {
            buttons.reject.addEventListener('click', function () {
                decide(false);
            });
        }
        if (buttons.reset) {
            buttons.reset.addEventListener('click', resetGate);
        }

        var initial = radios.filter(function (radio) {
            return radio.checked;
        })[0] || radios[0];
        initial.checked = true;
        selectScenario(initial, false);
        resetGate();
    }

    /* ==== 06 执行模式标签页 ==== */
    // 标准 tablist 键盘约定：左右/Home/End 移动并即时切换（自动激活模式）
    function initTabs() {
        var wrapper = document.querySelector('[data-ks-tabs]');
        if (!wrapper) {
            return;
        }
        var tabs = slice(wrapper.querySelectorAll('[role="tab"]'));
        if (!tabs.length) {
            return;
        }

        function select(index, focus) {
            tabs.forEach(function (tab, i) {
                var selected = i === index;
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
                tab.tabIndex = selected ? 0 : -1;
                var panel = document.getElementById(tab.getAttribute('aria-controls'));
                if (panel) {
                    panel.classList.toggle('is-active', selected);
                }
            });
            if (focus) {
                tabs[index].focus();
            }
        }

        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () {
                select(i, false);
            });
            tab.addEventListener('keydown', function (event) {
                var target = null;
                if (event.key === 'ArrowRight') {
                    target = (i + 1) % tabs.length;
                } else if (event.key === 'ArrowLeft') {
                    target = (i - 1 + tabs.length) % tabs.length;
                } else if (event.key === 'Home') {
                    target = 0;
                } else if (event.key === 'End') {
                    target = tabs.length - 1;
                }
                if (target === null) {
                    return;
                }
                event.preventDefault();
                select(target, true);
            });
        });

        var initialIndex = tabs.findIndex(function (tab) {
            return tab.getAttribute('aria-selected') === 'true';
        });
        select(initialIndex < 0 ? 0 : initialIndex, false);
    }

    /* ==== 07 终端打字机 ==== */
    // 内容本身写在 HTML 里（无脚本时就是一份可读的完整会话记录），
    // 脚本接管后按行逐字回放。任何异常都把原文还原，绝不让终端空着。
    function initTerminal() {
        var term = document.querySelector('[data-ks-term]');
        if (!term) {
            return;
        }
        var body = term.querySelector('[data-ks-term-body]');
        var replay = term.querySelector('[data-ks-term-replay]');
        if (!body) {
            return;
        }

        var lines = slice(body.querySelectorAll('.ks-term__line'));
        var records = lines.map(function (line) {
            var textEl = line.querySelector('.ks-term__text');
            return { line: line, textEl: textEl, value: textEl ? textEl.textContent : '' };
        });

        var runId = 0;
        var started = false;

        function restore() {
            runId += 1;
            records.forEach(function (record) {
                if (record.textEl) {
                    record.textEl.textContent = record.value;
                }
                record.line.classList.remove('is-pending', 'is-typing');
            });
            body.setAttribute('data-ks-armed', '');
        }

        function arm() {
            body.setAttribute('data-ks-armed', '');
            records.forEach(function (record) {
                if (record.textEl) {
                    record.textEl.textContent = '';
                }
                record.line.classList.add('is-pending');
            });
        }

        function play(force) {
            var id = ++runId;
            body.removeAttribute('data-ks-armed');
            // 先隐藏、再清空，最后立刻解除隐藏：整个过程在同一帧里完成，不会看到闪烁
            window.requestAnimationFrame(function () {
                if (id !== runId) {
                    return;
                }
                arm();
                if (prefersReducedMotion() && !force) {
                    // 减动效用户首次进视口直接看终态；主动点"重放"说明要看过程，就照常播放
                    restore();
                    return;
                }
                typeLine(id, 0);
            });
        }

        function typeLine(id, index) {
            if (id !== runId) {
                return;
            }
            if (index >= records.length) {
                return;
            }
            var record = records[index];
            record.line.classList.remove('is-pending');

            if (!record.textEl || !record.value) {
                // 只有提示符没有正文的行（最后一行）直接露面，让光标落位
                typeLine(id, index + 1);
                return;
            }

            var text = record.value;
            // 按行长动态调速：短行慢一点看得清，长行快一点不至于让人等
            var perChar = Math.min(16, Math.max(4, Math.round(700 / text.length)));
            var charIndex = 0;
            record.line.classList.add('is-typing');

            (function step() {
                if (id !== runId) {
                    return;
                }
                charIndex += 1;
                record.textEl.textContent = text.slice(0, charIndex);
                if (charIndex < text.length) {
                    window.setTimeout(step, perChar);
                    return;
                }
                record.line.classList.remove('is-typing');
                window.setTimeout(function () {
                    typeLine(id, index + 1);
                }, delay(120));
            })();
        }

        function start(force) {
            try {
                play(force);
            } catch (err) {
                restore();
            }
        }

        if (replay) {
            replay.addEventListener('click', function () {
                start(true);
            });
        }

        if (!('IntersectionObserver' in window)) {
            start(false);
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting || started) {
                    return;
                }
                started = true;
                observer.disconnect();
                start(false);
            });
        }, { threshold: 0.2 });

        observer.observe(term);
    }

    /* ==== 08 数字滚动 ==== */
    /* ==== 08 演示步骤播放器 ==== */
    // 六幕"像视频一样"播放：自动推进 + 播放/暂停 + 进度条 + 章节跳转。
    //
    // 为什么不做成真的视频：页面要保持自包含（不引外部素材），而且素材站那种
    // 通用产品演示与本平台能力无关。六幕正文全部常驻在 HTML 里，这里只切
    // is-active —— 所以即使脚本挂了，用户滚下去仍然能读到全部六幕。
    //
    // 两个刻意的行为：
    //   1. 播完停在最后一幕，**不循环** —— 循环会让人一直等着"下一轮"，
    //      而这里想看的是流程，看完就该停住让人读。
    //   2. 暂停的触发条件很多（用户按了暂停、滚出视口、切到后台页），
    //      但要区分"用户主动暂停"和"被动暂停"：被动暂停在条件恢复后要接着播，
    //      主动暂停则不能自作主张恢复。
    function initDemo() {
        var demo = document.querySelector('[data-ks-demo]');
        if (!demo) {
            return;
        }
        var scenes = slice(demo.querySelectorAll('[data-ks-demo-scene]'));
        var chapters = slice(demo.querySelectorAll('[data-ks-demo-chapter]'));
        var total = scenes.length;
        if (!total) {
            return;
        }

        var prevBtn = document.getElementById('ksDemoPrev');
        var nextBtn = document.getElementById('ksDemoNext');
        var toggleBtn = document.getElementById('ksDemoToggle');
        var toggleLabel = document.getElementById('ksDemoToggleLabel');
        var counterEl = demo.querySelector('[data-ks-demo-current]');
        var stage = demo.querySelector('[data-ks-demo-stage]');
        var track = demo.querySelector('[data-ks-demo-track]');
        var fill = demo.querySelector('[data-ks-demo-fill]');

        var ACT_MS = 4000;          // 每幕停留时长
        var index = 0;
        var timer = null;
        var userPaused = false;     // 用户主动暂停
        var inView = true;          // 是否在视口内
        var pageVisible = !document.hidden;
        var reduced = prefersReducedMotion();

        // 属性只用来给不跑脚本的场景兜底，真实状态始终由 JS 维护
        demo.setAttribute('data-ks-demo-total', String(total));

        function render() {
            scenes.forEach(function (scene, i) {
                scene.classList.toggle('is-active', i === index);
            });
            chapters.forEach(function (btn, i) {
                var active = i === index;
                btn.classList.toggle('is-active', active);
                // aria-current 只标当前项；其余必须移除，否则读屏会念出一串"当前"
                if (active) {
                    btn.setAttribute('aria-current', 'true');
                } else {
                    btn.removeAttribute('aria-current');
                }
            });
            if (counterEl) {
                counterEl.textContent = String(index + 1);
            }
            demo.setAttribute('data-ks-demo-index', String(index));
            if (track) {
                track.setAttribute('aria-valuenow', String(index + 1));
                track.setAttribute('aria-valuetext', '第 ' + (index + 1) + ' 幕，共 ' + total + ' 幕');
            }
            if (fill) {
                // 用"已看完的幕数"占比，最后一幕时正好铺满
                fill.style.width = (((index + 1) / total) * 100) + '%';
            }
            if (prevBtn) {
                prevBtn.disabled = index === 0;
            }
            if (nextBtn) {
                nextBtn.disabled = index === total - 1;
            }
        }

        function stopTimer() {
            if (timer) {
                window.clearTimeout(timer);
                timer = null;
            }
        }

        // 是否"此刻应该在播"：用户没暂停、在视口内、页面在前台、不要求减少动效
        function shouldRun() {
            return !userPaused && inView && pageVisible && !reduced;
        }

        function schedule() {
            stopTimer();
            if (!shouldRun() || index >= total - 1) {
                return;
            }
            timer = window.setTimeout(function () {
                go(index + 1);
            }, ACT_MS);
        }

        function go(next) {
            if (next < 0 || next >= total) {
                return;
            }
            index = next;
            render();
            // 自动与手动都要重排定时器：手动切幕之后如果不重置，
            // 刚点完就可能立刻被上一轮的计时器推进到下一幕。
            schedule();
        }

        function setPlaying(playing) {
            userPaused = !playing;
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
            }
            if (toggleLabel) {
                toggleLabel.textContent = playing ? '暂停' : '播放';
            }
            if (playing) {
                // 已经在最后一幕时按播放：从头开始，符合"重播"的直觉
                if (index >= total - 1) {
                    index = 0;
                    render();
                }
                schedule();
            } else {
                stopTimer();
            }
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                var playing = toggleBtn.getAttribute('aria-pressed') === 'true';
                setPlaying(!playing);
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                go(index - 1);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                go(index + 1);
            });
        }

        chapters.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = parseInt(btn.getAttribute('data-ks-demo-chapter'), 10);
                if (!isNaN(target)) {
                    go(target);
                }
            });
        });

        // 进度条点击跳转：按点击位置落在第几幕
        if (track) {
            track.addEventListener('click', function (event) {
                var rect = track.getBoundingClientRect();
                if (!rect.width) {
                    return;
                }
                var ratio = (event.clientX - rect.left) / rect.width;
                ratio = Math.max(0, Math.min(1, ratio));
                go(Math.min(total - 1, Math.floor(ratio * total)));
            });
            // 键盘：轨道本身是 role=slider，方向键必须能改值，
            // 否则"可聚焦但按了没反应"比不可聚焦更糟
            track.addEventListener('keydown', function (event) {
                var handled = true;
                switch (event.key) {
                    case 'ArrowRight': go(index + 1); break;
                    case 'ArrowLeft': go(index - 1); break;
                    case 'Home': go(0); break;
                    case 'End': go(total - 1); break;
                    case ' ':
                    case 'Enter':
                        setPlaying(toggleBtn ? toggleBtn.getAttribute('aria-pressed') !== 'true' : false);
                        break;
                    default: handled = false;
                }
                if (handled) {
                    event.preventDefault();
                }
            });
        }

        // 组件内的空格/方向键也接管，但不劫持整页：只在焦点位于组件内部时生效，
        // 否则用户在页脚按空格会被莫名其妙地暂停演示。
        demo.addEventListener('keydown', function (event) {
            if (event.target === track) {
                return;   // 轨道自己已经处理
            }
            var handled = true;
            switch (event.key) {
                case 'ArrowRight': go(index + 1); break;
                case 'ArrowLeft': go(index - 1); break;
                case ' ':
                    if (event.target.tagName === 'BUTTON') {
                        handled = false;    // 按钮上的空格是"点击"，别抢
                        break;
                    }
                    setPlaying(toggleBtn ? toggleBtn.getAttribute('aria-pressed') !== 'true' : false);
                    break;
                default: handled = false;
            }
            if (handled) {
                event.preventDefault();
            }
        });

        // 滚出视口就停：长页面里同时跑好几个动画很浪费，也没人看
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                    if (inView) {
                        schedule();
                    } else {
                        stopTimer();
                    }
                });
            }, { threshold: 0.25 });
            io.observe(demo);
        }

        // 切到后台页暂停，回到前台按原状态恢复（用户没主动暂停才继续）
        document.addEventListener('visibilitychange', function () {
            pageVisible = !document.hidden;
            if (pageVisible) {
                schedule();
            } else {
                stopTimer();
            }
        });

        // 系统主题/动效偏好可能在页面打开后才被改（比如用户去系统设置里开"减少动效"）
        if (motionQuery && motionQuery.addEventListener) {
            motionQuery.addEventListener('change', function () {
                reduced = prefersReducedMotion();
                if (reduced) {
                    stopTimer();
                } else {
                    schedule();
                }
            });
        }

        render();

        if (reduced) {
            // 减少动效：不自动播，直接静态呈现第一幕并让用户手动切
            userPaused = true;
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-pressed', 'false');
            }
            if (toggleLabel) {
                toggleLabel.textContent = '播放';
            }
            return;
        }

        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', 'true');
        }
        if (toggleLabel) {
            toggleLabel.textContent = '暂停';
        }
        schedule();
    }

    function initCounters() {
        var counters = slice(document.querySelectorAll('[data-ks-count]'));
        if (!counters.length) {
            return;
        }
        // 无脚本/减动效时 HTML 里写的就是终值，这里不动它
        if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
            return;
        }

        function run(el) {
            var target = parseInt(el.getAttribute('data-ks-count'), 10);
            if (isNaN(target)) {
                return;
            }
            var width = parseInt(el.getAttribute('data-ks-pad'), 10) || 0;
            var duration = 1100;
            var startAt = 0;

            function frame(now) {
                if (!startAt) {
                    startAt = now;
                }
                var ratio = Math.min(1, (now - startAt) / duration);
                // 先快后慢，收尾时数字停顿得下来，比线性更像"锁定"
                var eased = 1 - Math.pow(1 - ratio, 3);
                var value = Math.round(target * eased);
                el.textContent = width ? pad(value, width) : String(value);
                if (ratio < 1) {
                    window.requestAnimationFrame(frame);
                }
            }

            el.textContent = width ? pad(0, width) : '0';
            window.requestAnimationFrame(frame);
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                observer.unobserve(entry.target);
                run(entry.target);
            });
        }, { threshold: 0.5 });

        counters.forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ==== 09 页脚年份 ==== */
    function initYear() {
        var targets = slice(document.querySelectorAll('[data-ks-year]'));
        if (!targets.length) {
            return;
        }
        var year = String(new Date().getFullYear());
        targets.forEach(function (el) {
            el.textContent = year;
        });
    }

    /* ==== 10 宣传片播放 ==== */
    // 自定义播放钮盖住 poster；开播后交给原生 controls，暂停结束再露出封面钮。
    function initFilm() {
        var root = document.querySelector('[data-ks-film]');
        if (!root) {
            return;
        }
        var video = root.querySelector('.ks-film__video');
        var playBtn = root.querySelector('[data-ks-film-play]');
        if (!video || !playBtn) {
            return;
        }

        function setPlaying(on) {
            if (on) {
                root.classList.add('is-playing');
            } else {
                root.classList.remove('is-playing');
            }
        }

        playBtn.addEventListener('click', function () {
            var start = video.play();
            if (start && typeof start.then === 'function') {
                start.then(function () {
                    setPlaying(true);
                }).catch(function () {
                    // 自动播放策略拦截时保留封面钮，用户可再点原生控件
                    setPlaying(false);
                });
            } else {
                setPlaying(true);
            }
        });

        video.addEventListener('play', function () { setPlaying(true); });
        video.addEventListener('playing', function () { setPlaying(true); });
        video.addEventListener('pause', function () {
            if (!video.ended) {
                setPlaying(false);
            }
        });
        video.addEventListener('ended', function () {
            setPlaying(false);
            try { video.currentTime = 0; } catch (err) { /* ignore */ }
        });
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
            return;
        }
        fn();
    }

    ready(function () {
        // 一进来就告诉首页的看门狗"脚本跑起来了"，让它别把 ks-js 摘掉。
        // 放在最前面是刻意的：看门狗要区分的是"脚本压根没执行"和"执行了但慢"，
        // 只要执行到了这里就说明是后者。
        window.__ksHomeReady = true;
        if (window.__ksWatchdog) {
            window.clearTimeout(window.__ksWatchdog);
            window.__ksWatchdog = null;
        }

        // 每个模块单独 try/catch：它们互相独立，一个坏掉不该连累其余的。
        // 尤其不能连累 initReveal —— 那会让整页停在 opacity:0。
        function run(name, fn) {
            try {
                fn();
            } catch (error) {
                console.error('[home] ' + name + ' 初始化失败:', error);
            }
        }

        // 终端排在最前：它的正文在脚本接管前是 CSS 隐藏的。
        run('terminal', initTerminal);
        run('theme', initTheme);
        run('reveal', initReveal);
        run('chain', initChain);
        run('gate', initGate);
        run('tabs', initTabs);
        run('demo', initDemo);
        run('counters', initCounters);
        run('year', initYear);
        run('film', initFilm);
        run('pointerFx', initPointerFx);

        /* ==== 10 指针交互：Hero 光晕跟随 + 能力卡轻倾斜 ==== */
        function initPointerFx() {
            if (prefersReducedMotion()) return;
            var hero = document.getElementById('ks-top');
            var glow = hero ? hero.querySelector('.ks-hero__glow') : null;
            if (hero && glow) {
                hero.addEventListener('pointermove', function (ev) {
                    var rect = hero.getBoundingClientRect();
                    var x = ((ev.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 36;
                    var y = ((ev.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 28;
                    glow.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
                });
                hero.addEventListener('pointerleave', function () {
                    glow.style.transform = 'translate3d(0,0,0)';
                });
            }

            slice(document.querySelectorAll('.ks-card')).forEach(function (card) {
                card.addEventListener('pointermove', function (ev) {
                    var rect = card.getBoundingClientRect();
                    var px = (ev.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
                    var py = (ev.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
                    card.classList.add('is-tilting');
                    card.style.transform =
                        'translateY(-4px) rotateX(' + (-py * 5).toFixed(2) + 'deg) rotateY(' + (px * 6).toFixed(2) + 'deg)';
                });
                card.addEventListener('pointerleave', function () {
                    card.classList.remove('is-tilting');
                    card.style.transform = '';
                });
            });
        }

        // 这里**故意不做**"检查有没有元素被点亮"的自检。
        //
        // 我加过一版，结果是每次正常加载都误判：22 个 [data-ks-reveal] 全都在
        // 首屏以下，滚动到才进场 —— 所以"此刻还没有任何 is-visible"是**正常状态**，
        // 不是故障。于是兜底被无条件触发，ks-js 每次都被摘掉，进场动画从此形同虚设。
        // 把它删掉之后动画恢复正常（实测滚完 22/22 点亮）。
        //
        // 真正的失败模式是"home.js 压根没执行"，那个由 home.html 里基于
        // __ksHomeReady 的看门狗负责，判据明确、不会误伤。
        // initReveal 自身也有兜底：不支持 IntersectionObserver 或用户要求减少动效时，
        // 它会直接 showAll()。
    });
})();
