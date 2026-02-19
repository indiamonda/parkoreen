/**
 * Python Compiler - Standalone Module
 * Compiles and executes Python code in the browser using Skulpt
 * All files in assets/plugins/code/js/
 * 
 * Required files (same folder):
 *   - skulpt.min.js
 *   - skulpt-stdlib.js
 */

(function(global) {
    'use strict';
    
    // Local paths for Skulpt (relative to HTML page)
    const SKULPT_LOCAL = 'assets/plugins/code/js/skulpt.min.js';
    const SKULPT_STDLIB_LOCAL = 'assets/plugins/code/js/skulpt-stdlib.js';
    
    // Alternative: absolute path from plugin base
    let basePath = '';
    
    // Loading state
    let skulptLoading = null;
    let skulptLoaded = false;
    
    /**
     * Set the base path for loading Skulpt files
     * @param {string} path - Base path (e.g., '/parkoreen/')
     */
    function setBasePath(path) {
        basePath = path.endsWith('/') ? path : path + '/';
    }
    
    /**
     * Load a script from URL
     * @param {string} src - Script URL
     * @returns {Promise}
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Ensure Skulpt is loaded from local files
     * @returns {Promise}
     */
    async function ensureSkulptLoaded() {
        // Check if already loaded (either by us or by plugin loader)
        if (typeof Sk !== 'undefined' && Sk.builtinFiles) {
            skulptLoaded = true;
            return Promise.resolve();
        }
        
        // Currently loading - wait for it
        if (skulptLoading) {
            return skulptLoading;
        }
        
        // Start loading (fallback if not pre-loaded by plugin system)
        skulptLoading = (async () => {
            try {
                const skulptPath = basePath + SKULPT_LOCAL;
                const stdlibPath = basePath + SKULPT_STDLIB_LOCAL;
                
                // Load main Skulpt library
                await loadScript(skulptPath);
                
                // Wait a moment for Sk to be defined
                await new Promise(resolve => setTimeout(resolve, 50));
                
                if (typeof Sk === 'undefined') {
                    throw new Error('Skulpt failed to load from: ' + skulptPath);
                }
                
                // Load standard library
                await loadScript(stdlibPath);
                
                // Wait for stdlib to initialize
                await new Promise(resolve => setTimeout(resolve, 50));
                
                skulptLoaded = true;
            } catch (error) {
                skulptLoading = null;
                throw error;
            }
        })();
        
        return skulptLoading;
    }
    
    /**
     * Python Compiler Class
     */
    class PythonCompiler {
        constructor(options = {}) {
            this.output = '';
            this.errors = [];
            this.isRunning = false;
            this.startTime = 0;
            this.executionTime = 0;
            
            // Callbacks
            this.onOutput = options.onOutput || null;
            this.onError = options.onError || null;
            this.onComplete = options.onComplete || null;
            this.onInput = options.onInput || null;
            
            // Set base path if provided
            if (options.basePath) {
                setBasePath(options.basePath);
            }
        }
        
        /**
         * Configure Skulpt with output and input handlers
         */
        configure() {
            const self = this;
            
            Sk.configure({
                // Output function - called when Python prints something
                output: (text) => {
                    self.output += text;
                    if (self.onOutput) {
                        self.onOutput(text);
                    }
                },
                
                // Input function - called when Python needs input
                inputfun: (prompt) => {
                    if (self.onInput) {
                        return self.onInput(prompt);
                    }
                    return window.prompt(prompt);
                },
                inputfunTakesPrompt: true,
                
                // Read built-in files (standard library)
                read: (filename) => {
                    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][filename] === undefined) {
                        throw new Error("File not found: '" + filename + "'");
                    }
                    return Sk.builtinFiles["files"][filename];
                },
                
                // Use Python 3 syntax
                __future__: Sk.python3
            });
        }
        
        /**
         * Compile and run Python code
         * @param {string} code - Python source code
         * @returns {Promise} - Resolves with result object
         */
        async run(code) {
            // Ensure Skulpt is loaded
            try {
                await ensureSkulptLoaded();
            } catch (loadError) {
                const response = {
                    success: false,
                    output: '',
                    error: 'Failed to load Python compiler: ' + loadError.message,
                    executionTime: 0
                };
                if (this.onError) this.onError(loadError);
                if (this.onComplete) this.onComplete(response);
                return response;
            }
            
            // Reset state
            this.output = '';
            this.errors = [];
            this.isRunning = true;
            this.startTime = Date.now();
            
            // Configure Skulpt
            this.configure();
            
            try {
                // Compile and execute
                const result = await Sk.misceval.asyncToPromise(() => {
                    return Sk.importMainWithBody("<stdin>", false, code, true);
                });
                
                this.executionTime = Date.now() - this.startTime;
                this.isRunning = false;
                
                const response = {
                    success: true,
                    output: this.output,
                    executionTime: this.executionTime,
                    result: result
                };
                
                if (this.onComplete) {
                    this.onComplete(response);
                }
                
                return response;
                
            } catch (error) {
                this.executionTime = Date.now() - this.startTime;
                this.isRunning = false;
                this.errors.push(error);
                
                const response = {
                    success: false,
                    output: this.output,
                    error: this.formatError(error),
                    executionTime: this.executionTime
                };
                
                if (this.onError) {
                    this.onError(error);
                }
                
                if (this.onComplete) {
                    this.onComplete(response);
                }
                
                return response;
            }
        }
        
        /**
         * Format error for display
         * @param {Error} error - Error object
         * @returns {string} - Formatted error string
         */
        formatError(error) {
            if (error.toString) {
                return error.toString();
            }
            return String(error);
        }
        
        /**
         * Get execution time in milliseconds
         * @returns {number}
         */
        getExecutionTime() {
            return this.executionTime;
        }
        
        /**
         * Get all output as string
         * @returns {string}
         */
        getOutput() {
            return this.output;
        }
        
        /**
         * Clear output and errors
         */
        clear() {
            this.output = '';
            this.errors = [];
            this.executionTime = 0;
        }
        
        /**
         * Check if Skulpt is loaded and ready
         * @returns {boolean}
         */
        static isReady() {
            return skulptLoaded && typeof Sk !== 'undefined';
        }
        
        /**
         * Preload Skulpt (call early to avoid delay on first run)
         * @returns {Promise}
         */
        static preload() {
            return ensureSkulptLoaded();
        }
        
        /**
         * Set the base path for loading Skulpt files
         * @param {string} path - Base path
         */
        static setBasePath(path) {
            setBasePath(path);
        }
    }
    
    /**
     * Simple function to run Python code (convenience wrapper)
     * @param {string} code - Python code to execute
     * @param {object} options - Optional callbacks
     * @returns {Promise} - Result object
     */
    async function runPython(code, options = {}) {
        const compiler = new PythonCompiler(options);
        return compiler.run(code);
    }
    
    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { PythonCompiler, runPython };
    }
    
    // Make available globally
    global.PythonCompiler = PythonCompiler;
    global.runPython = runPython;
    
})(typeof window !== 'undefined' ? window : this);
