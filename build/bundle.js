
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }


    /* src\App.svelte generated by Svelte v3.46.4 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i];
    	return child_ctx;
    }

    // (583:35) 
    function create_if_block_2(ctx) {
    	let div;
    	let t_value = /*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]].toUpperCase() + "";
    	let t;
    	let div_style_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "id", "square");

    			attr_dev(div, "style", div_style_value = /*word*/ ctx[6][/*i*/ ctx[21]] == /*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]]
    			? "background-color: green;"
    			: /*word*/ ctx[6].includes(/*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]])
    				? "background-color: yellow;"
    				: "");

    			attr_dev(div, "class", "svelte-sxoigd");
    			add_location(div, file, 583, 6, 8060);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*current_guesses*/ 2 && t_value !== (t_value = /*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]].toUpperCase() + "")) set_data_dev(t, t_value);

    			if (dirty & /*current_guesses*/ 2 && div_style_value !== (div_style_value = /*word*/ ctx[6][/*i*/ ctx[21]] == /*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]]
    			? "background-color: green;"
    			: /*word*/ ctx[6].includes(/*current_guesses*/ ctx[1][/*row*/ ctx[18]][/*i*/ ctx[21]])
    				? "background-color: yellow;"
    				: "")) {
    				attr_dev(div, "style", div_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(583:35) ",
    		ctx
    	});

    	return block;
    }

    // (577:5) {#if current_guess == row}
    function create_if_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[21] < /*current*/ ctx[0].length && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[21] < /*current*/ ctx[0].length) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(577:5) {#if current_guess == row}",
    		ctx
    	});

    	return block;
    }

    // (578:6) {#if i < current.length}
    function create_if_block_1(ctx) {
    	let div;
    	let t_value = /*current*/ ctx[0].split("")[/*i*/ ctx[21]].toUpperCase() + "";
    	let t;
    	let div_style_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "id", "square");
    			attr_dev(div, "style", div_style_value = /*wrong*/ ctx[3] ? "background-color: red;" : "");
    			attr_dev(div, "class", "svelte-sxoigd");
    			add_location(div, file, 578, 7, 7883);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*current*/ 1 && t_value !== (t_value = /*current*/ ctx[0].split("")[/*i*/ ctx[21]].toUpperCase() + "")) set_data_dev(t, t_value);

    			if (dirty & /*wrong*/ 8 && div_style_value !== (div_style_value = /*wrong*/ ctx[3] ? "background-color: red;" : "")) {
    				attr_dev(div, "style", div_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(578:6) {#if i < current.length}",
    		ctx
    	});

    	return block;
    }

    // (575:3) {#each letters as i}
    function create_each_block_1(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*current_guess*/ ctx[2] == /*row*/ ctx[18]) return create_if_block;
    		if (/*row*/ ctx[18] < /*current_guess*/ ctx[2]) return create_if_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "id", "square_big");
    			attr_dev(div, "class", "svelte-sxoigd");
    			add_location(div, file, 575, 4, 7791);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(575:3) {#each letters as i}",
    		ctx
    	});

    	return block;
    }

    // (573:1) {#each letters as row}
    function create_each_block(ctx) {
    	let div;
    	let each_value_1 = /*letters*/ ctx[5];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "wordle svelte-sxoigd");
    			add_location(div, file, 573, 2, 7742);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*wrong, current, letters, current_guess, word, current_guesses*/ 111) {
    				each_value_1 = /*letters*/ ctx[5];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(573:1) {#each letters as row}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let t0;
    	let div;
    	let span0;
    	let t1;
    	let progress0;
    	let progress0_value_value;
    	let t2;
    	let span1;
    	let t3;
    	let progress1;
    	let progress1_value_value;
    	let t4;
    	let span2;
    	let t5;
    	let progress2;
    	let progress2_value_value;
    	let t6;
    	let span3;
    	let t7;
    	let progress3;
    	let progress3_value_value;
    	let t8;
    	let span4;
    	let t9;
    	let progress4;
    	let progress4_value_value;
    	let t10;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*letters*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div = element("div");
    			span0 = element("span");
    			t1 = text("Completed in 1 try ");
    			progress0 = element("progress");
    			t2 = space();
    			span1 = element("span");
    			t3 = text("Completed in 2 try ");
    			progress1 = element("progress");
    			t4 = space();
    			span2 = element("span");
    			t5 = text("Completed in 3 try ");
    			progress2 = element("progress");
    			t6 = space();
    			span3 = element("span");
    			t7 = text("Completed in 4 try ");
    			progress3 = element("progress");
    			t8 = space();
    			span4 = element("span");
    			t9 = text("Completed in 5 try ");
    			progress4 = element("progress");
    			t10 = space();
    			button = element("button");
    			button.textContent = "Clear savedata";
    			attr_dev(progress0, "id", "stats-1");
    			progress0.value = progress0_value_value = /*save_data*/ ctx[4][1].toString();
    			attr_dev(progress0, "max", /*max_progess*/ ctx[7]);
    			add_location(progress0, file, 592, 27, 8382);
    			add_location(span0, file, 592, 2, 8357);
    			attr_dev(progress1, "id", "stats-2");
    			progress1.value = progress1_value_value = /*save_data*/ ctx[4][2].toString();
    			attr_dev(progress1, "max", /*max_progess*/ ctx[7]);
    			add_location(progress1, file, 593, 27, 8492);
    			add_location(span1, file, 593, 2, 8467);
    			attr_dev(progress2, "id", "stats-3");
    			progress2.value = progress2_value_value = /*save_data*/ ctx[4][3].toString();
    			attr_dev(progress2, "max", /*max_progess*/ ctx[7]);
    			add_location(progress2, file, 594, 27, 8602);
    			add_location(span2, file, 594, 2, 8577);
    			attr_dev(progress3, "id", "stats-4");
    			progress3.value = progress3_value_value = /*save_data*/ ctx[4][4].toString();
    			attr_dev(progress3, "max", /*max_progess*/ ctx[7]);
    			add_location(progress3, file, 595, 27, 8712);
    			add_location(span3, file, 595, 2, 8687);
    			attr_dev(progress4, "id", "stats-5");
    			progress4.value = progress4_value_value = /*save_data*/ ctx[4][5].toString();
    			attr_dev(progress4, "max", /*max_progess*/ ctx[7]);
    			add_location(progress4, file, 596, 27, 8822);
    			add_location(span4, file, 596, 2, 8797);
    			attr_dev(div, "id", "stats");
    			attr_dev(div, "class", "svelte-sxoigd");
    			add_location(div, file, 591, 1, 8338);
    			add_location(button, file, 598, 1, 8914);
    			attr_dev(main, "class", "svelte-sxoigd");
    			add_location(main, file, 571, 0, 7709);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			append_dev(main, t0);
    			append_dev(main, div);
    			append_dev(div, span0);
    			append_dev(span0, t1);
    			append_dev(span0, progress0);
    			append_dev(div, t2);
    			append_dev(div, span1);
    			append_dev(span1, t3);
    			append_dev(span1, progress1);
    			append_dev(div, t4);
    			append_dev(div, span2);
    			append_dev(span2, t5);
    			append_dev(span2, progress2);
    			append_dev(div, t6);
    			append_dev(div, span3);
    			append_dev(span3, t7);
    			append_dev(span3, progress3);
    			append_dev(div, t8);
    			append_dev(div, span4);
    			append_dev(span4, t9);
    			append_dev(span4, progress4);
    			append_dev(main, t10);
    			append_dev(main, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*letters, wrong, current, current_guess, word, current_guesses*/ 111) {
    				each_value = /*letters*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(main, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*save_data*/ 16 && progress0_value_value !== (progress0_value_value = /*save_data*/ ctx[4][1].toString())) {
    				prop_dev(progress0, "value", progress0_value_value);
    			}

    			if (dirty & /*save_data*/ 16 && progress1_value_value !== (progress1_value_value = /*save_data*/ ctx[4][2].toString())) {
    				prop_dev(progress1, "value", progress1_value_value);
    			}

    			if (dirty & /*save_data*/ 16 && progress2_value_value !== (progress2_value_value = /*save_data*/ ctx[4][3].toString())) {
    				prop_dev(progress2, "value", progress2_value_value);
    			}

    			if (dirty & /*save_data*/ 16 && progress3_value_value !== (progress3_value_value = /*save_data*/ ctx[4][4].toString())) {
    				prop_dev(progress3, "value", progress3_value_value);
    			}

    			if (dirty & /*save_data*/ 16 && progress4_value_value !== (progress4_value_value = /*save_data*/ ctx[4][5].toString())) {
    				prop_dev(progress4, "value", progress4_value_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	var words = [
    		"faith",
    		"story",
    		"judge",
    		"piano",
    		"angry",
    		"upper",
    		"swear",
    		"skill",
    		"issue",
    		"moral",
    		"ahead",
    		"minor",
    		"mayor",
    		"proof",
    		"swing",
    		"draft",
    		"relax",
    		"fresh",
    		"worth",
    		"union",
    		"laugh",
    		"first",
    		"frame",
    		"bring",
    		"these",
    		"heart",
    		"trace",
    		"chest",
    		"super",
    		"lover",
    		"eager",
    		"often",
    		"stuff",
    		"drive",
    		"smoke",
    		"leave",
    		"smart",
    		"large",
    		"strip",
    		"until",
    		"after",
    		"rough",
    		"empty",
    		"habit",
    		"worry",
    		"agent",
    		"media",
    		"movie",
    		"fence",
    		"whose",
    		"match",
    		"stage",
    		"cable",
    		"grade",
    		"aware",
    		"since",
    		"river",
    		"paint",
    		"earth",
    		"three",
    		"chain",
    		"stand",
    		"under",
    		"terms",
    		"water",
    		"plate",
    		"shoot",
    		"clear",
    		"bench",
    		"route",
    		"humor",
    		"fifth",
    		"chart",
    		"grass",
    		"admit",
    		"uncle",
    		"coast",
    		"angle",
    		"power",
    		"basis",
    		"quick",
    		"party",
    		"forth",
    		"seven",
    		"solve",
    		"lucky",
    		"prime",
    		"award",
    		"weigh",
    		"horse",
    		"cloud",
    		"speed",
    		"theme",
    		"there",
    		"teach",
    		"elite",
    		"trail",
    		"truly",
    		"truck",
    		"trade",
    		"scale",
    		"wheel",
    		"dirty",
    		"blame",
    		"chair",
    		"state",
    		"newly",
    		"daily",
    		"dance",
    		"legal",
    		"rifle",
    		"month",
    		"young",
    		"great",
    		"shell",
    		"anger",
    		"alter",
    		"taste",
    		"shall",
    		"tight",
    		"count",
    		"stock",
    		"might",
    		"child",
    		"clock",
    		"stick",
    		"early",
    		"quiet",
    		"brand",
    		"awful",
    		"fault",
    		"blade",
    		"today",
    		"false",
    		"north",
    		"treat",
    		"coach",
    		"giant",
    		"essay",
    		"mouse",
    		"house",
    		"speak",
    		"broad",
    		"elect",
    		"stone",
    		"steel",
    		"field",
    		"shirt",
    		"plane",
    		"voter",
    		"store",
    		"react",
    		"meter",
    		"other",
    		"money",
    		"marry",
    		"storm",
    		"green",
    		"those",
    		"build",
    		"given",
    		"track",
    		"yours",
    		"plant",
    		"whole",
    		"trust",
    		"cause",
    		"drama",
    		"order",
    		"sharp",
    		"delay",
    		"grave",
    		"human",
    		"value",
    		"music",
    		"total",
    		"alone",
    		"block",
    		"knock",
    		"shore",
    		"irish",
    		"armed",
    		"model",
    		"salad",
    		"virus",
    		"trial",
    		"pause",
    		"aside",
    		"layer",
    		"nurse",
    		"lemon",
    		"crime",
    		"guess",
    		"tough",
    		"entry",
    		"buyer",
    		"eight",
    		"noise",
    		"sweet",
    		"chase",
    		"color",
    		"enjoy",
    		"pilot",
    		"motor",
    		"below",
    		"cross",
    		"still",
    		"thank",
    		"local",
    		"heavy",
    		"write",
    		"level",
    		"patch",
    		"shake",
    		"price",
    		"front",
    		"sight",
    		"raise",
    		"prove",
    		"least",
    		"rapid",
    		"solar",
    		"mount",
    		"again",
    		"carry",
    		"ghost",
    		"reach",
    		"fight",
    		"shift",
    		"metal",
    		"major",
    		"honey",
    		"ought",
    		"steal",
    		"sugar",
    		"sorry",
    		"sound",
    		"ratio",
    		"youth",
    		"float",
    		"mouth",
    		"short",
    		"light",
    		"sport",
    		"while",
    		"grain",
    		"dream",
    		"adopt",
    		"loose",
    		"drink",
    		"thick",
    		"basic",
    		"urban",
    		"force",
    		"woman",
    		"cycle",
    		"usual",
    		"staff",
    		"yield",
    		"troop",
    		"watch",
    		"cheek",
    		"crack",
    		"south",
    		"touch",
    		"place",
    		"novel",
    		"fiber",
    		"solid",
    		"asset",
    		"final",
    		"throw",
    		"slave",
    		"score",
    		"print",
    		"thing",
    		"lower",
    		"blind",
    		"video",
    		"sauce",
    		"occur",
    		"stare",
    		"dozen",
    		"black",
    		"pitch",
    		"equal",
    		"seize",
    		"label",
    		"their",
    		"exist",
    		"break",
    		"inner",
    		"small",
    		"start",
    		"every",
    		"ready",
    		"panel",
    		"hotel",
    		"birth",
    		"juice",
    		"favor",
    		"night",
    		"prior",
    		"sleep",
    		"maker",
    		"enemy",
    		"above",
    		"being",
    		"dress",
    		"style",
    		"tower",
    		"album",
    		"iraqi",
    		"rural",
    		"limit",
    		"funny",
    		"split",
    		"proud",
    		"cheap",
    		"naked",
    		"crazy",
    		"sheet",
    		"wound",
    		"scope",
    		"white",
    		"slice",
    		"imply",
    		"begin",
    		"pound",
    		"glove",
    		"shout",
    		"right",
    		"trick",
    		"visit",
    		"where",
    		"chief",
    		"trend",
    		"check",
    		"slide",
    		"along",
    		"would",
    		"think",
    		"voice",
    		"round",
    		"radio",
    		"grand",
    		"scene",
    		"shelf",
    		"sweep",
    		"shape",
    		"exact",
    		"about",
    		"catch",
    		"bread",
    		"allow",
    		"labor",
    		"smile",
    		"topic",
    		"tired",
    		"fully",
    		"climb",
    		"cream",
    		"smell",
    		"title",
    		"learn",
    		"never",
    		"brain",
    		"crowd",
    		"vital",
    		"class",
    		"doubt",
    		"serve",
    		"glass",
    		"bible",
    		"bunch",
    		"guard",
    		"honor",
    		"claim",
    		"crash",
    		"couch",
    		"tooth",
    		"guide",
    		"abuse",
    		"which",
    		"pride",
    		"happy",
    		"adult",
    		"depth",
    		"train",
    		"stake",
    		"study",
    		"table",
    		"quote",
    		"owner",
    		"truth",
    		"quite",
    		"close",
    		"photo",
    		"third",
    		"avoid",
    		"group",
    		"argue",
    		"extra",
    		"apply",
    		"sense",
    		"spend",
    		"nerve",
    		"phase",
    		"board",
    		"piece",
    		"apart",
    		"fewer",
    		"cabin",
    		"waste",
    		"ocean",
    		"court",
    		"shrug",
    		"agree",
    		"ideal",
    		"among",
    		"grant",
    		"alive",
    		"refer",
    		"arise",
    		"enter",
    		"beach",
    		"later",
    		"range",
    		"phone",
    		"fifty",
    		"joint",
    		"actor",
    		"floor",
    		"wrong",
    		"latin",
    		"stair",
    		"guest",
    		"twice",
    		"porch",
    		"asian",
    		"adapt",
    		"error",
    		"flesh",
    		"onion",
    		"peace",
    		"reply",
    		"shine",
    		"share",
    		"brown",
    		"maybe",
    		"focus",
    		"blood",
    		"hello",
    		"apple",
    		"craft",
    		"sales",
    		"point",
    		"fruit",
    		"badly",
    		"brief",
    		"image",
    		"cover",
    		"tribe",
    		"brush",
    		"flame",
    		"could",
    		"event",
    		"found",
    		"world",
    		"brick",
    		"works",
    		"space",
    		"offer",
    		"index",
    		"death",
    		"lunch",
    		"civil",
    		"press",
    		"paper",
    		"knife",
    		"shade",
    		"shock",
    		"clean"
    	];

    	let current = "";
    	let letters = [0, 1, 2, 3, 4];
    	let startDate = "2022-01-01";
    	let date1 = new Date();
    	let date2 = new Date(startDate);
    	let timeInMilisec = date1.getTime() - date2.getTime();
    	let daysBetweenDates = Math.ceil(timeInMilisec / (1000 * 60 * 60 * 24));
    	let word = words[daysBetweenDates];
    	let current_guesses = [];
    	let current_guess = 0;
    	let stop = false;
    	let wrong = false;

    	let save_data = JSON.parse(localStorage.getItem('stats')) == null
    	? {
    			"1": "0",
    			"2": "0",
    			"3": "0",
    			"4": "0",
    			"5": "0",
    			"last_played": "",
    			"last_played_words": [],
    			"last_played_guesses": ""
    		}
    	: JSON.parse(localStorage.getItem('stats'));

    	let max_progess = (parseInt(save_data["1"]) + parseInt(save_data["2"]) + parseInt(save_data["3"]) + parseInt(save_data["4"]) + parseInt(save_data["5"])).toString();

    	if (save_data["last_played"] == new Date().toDateString()) {
    		current_guesses = save_data["last_played_words"];
    		current_guess = save_data["last_played_guesses"];
    		stop = true;
    	}

    	let counter = 0;

    	const interval = setInterval(
    		() => {
    			!wrong
    			? counter = 0
    			: counter > 60
    				? $$invalidate(3, wrong = false)
    				: counter++;
    		},
    		1
    	);

    	// console.log(save_data)
    	document.onkeypress = function (event) {
    		if (stop) return;

    		let char = typeof event !== 'undefined'
    		? event.keyCode
    		: event.which;

    		if (current.length < 5 && char != 32 && char != 13 && char != 8) $$invalidate(0, current += String.fromCharCode(char));
    		current.replace(" ", "");
    		$$invalidate(0, current);
    	};

    	document.onkeydown = function () {
    		var key = event.keyCode || event.charCode;

    		// console.log(key)
    		if (stop) return;

    		if (key == 8) {
    			$$invalidate(0, current = current.slice(0, -1));
    		} else if (key == 13) {
    			if (current.length == 5 && word_list.includes(current)) {
    				$$invalidate(1, current_guesses[current_guess] = current, current_guesses);
    				$$invalidate(2, current_guess++, current_guess);

    				if (current == word) {
    					stop = true;
    					$$invalidate(4, save_data["last_played"] = new Date().toDateString(), save_data);
    					$$invalidate(4, save_data["last_played_words"] = current_guesses, save_data);
    					$$invalidate(4, save_data["last_played_guesses"] = current_guess.toString(), save_data);
    					$$invalidate(4, save_data[current_guess.toString()] = (parseInt(save_data[current_guess.toString()]) + 1).toString(), save_data);
    					localStorage.setItem('stats', JSON.stringify(save_data));
    				}

    				$$invalidate(0, current = "");
    				$$invalidate(0, current = current.slice(0, -1));
    			} else if (!word_list.includes(current)) {
    				$$invalidate(3, wrong = true);
    			}
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		localStorage.removeItem('stats');
    	};

    	$$self.$capture_state = () => ({
    		words,
    		word_list,
    		current,
    		letters,
    		startDate,
    		date1,
    		date2,
    		timeInMilisec,
    		daysBetweenDates,
    		word,
    		current_guesses,
    		current_guess,
    		stop,
    		wrong,
    		save_data,
    		max_progess,
    		counter,
    		interval
    	});

    	$$self.$inject_state = $$props => {
    		if ('words' in $$props) words = $$props.words;
    		if ('current' in $$props) $$invalidate(0, current = $$props.current);
    		if ('letters' in $$props) $$invalidate(5, letters = $$props.letters);
    		if ('startDate' in $$props) startDate = $$props.startDate;
    		if ('date1' in $$props) date1 = $$props.date1;
    		if ('date2' in $$props) date2 = $$props.date2;
    		if ('timeInMilisec' in $$props) timeInMilisec = $$props.timeInMilisec;
    		if ('daysBetweenDates' in $$props) daysBetweenDates = $$props.daysBetweenDates;
    		if ('word' in $$props) $$invalidate(6, word = $$props.word);
    		if ('current_guesses' in $$props) $$invalidate(1, current_guesses = $$props.current_guesses);
    		if ('current_guess' in $$props) $$invalidate(2, current_guess = $$props.current_guess);
    		if ('stop' in $$props) stop = $$props.stop;
    		if ('wrong' in $$props) $$invalidate(3, wrong = $$props.wrong);
    		if ('save_data' in $$props) $$invalidate(4, save_data = $$props.save_data);
    		if ('max_progess' in $$props) $$invalidate(7, max_progess = $$props.max_progess);
    		if ('counter' in $$props) counter = $$props.counter;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		current,
    		current_guesses,
    		current_guess,
    		wrong,
    		save_data,
    		letters,
    		word,
    		max_progess,
    		click_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {

    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map