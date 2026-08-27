/**
 * VIVA DEMONSTRATION MODULE
 * This file contains clean, production-relevant code patterns explicitly demonstrating
 * fundamental JavaScript concepts required for the viva examination.
 */

// 1. HOISTING DEMONSTRATION
// Function declarations are hoisted to the top of their scope, allowing them to be called
// before their line of definition. In contrast, const/let variables are hoisted to the "Temporal Dead Zone".
export function demonstrateHoisting() {
  const result = helperFunctionHoisted("Viva Test"); // Works due to function declaration hoisting
  return result;
}

function helperFunctionHoisted(input) {
  return `Hoisted function processed: ${input}`;
}

// 2. CLOSURE DEMONSTRATION
// A closure is the combination of a function bundled together with references to its surrounding lexical state.
// In this codebase, higher-order middleware functions (like requireRole or rateLimiter factories) use closures
// to preserve configuration parameters across HTTP request cycles.
export function createRoleCheckerClosure(allowedRole) {
  // `allowedRole` is captured in the outer lexical environment
  return function checkUserRole(userRole) {
    // Accesses `allowedRole` from outer scope long after `createRoleCheckerClosure` has returned
    return userRole === allowedRole;
  };
}

// 3. PROMISES VS CALLBACKS DEMONSTRATION
// Modern JavaScript uses Promises and async/await to prevent "callback hell" and handle asynchronous operations cleanly.
export function callbackToPromiseDemo(asyncDataFetcherCallback) {
  return new Promise((resolve, reject) => {
    asyncDataFetcherCallback((err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// 4. EVENT LOOP DEMONSTRATION EXPLANATION
// The JavaScript runtime operates on a single-threaded Event Loop:
// - Call Stack: Executes synchronous code line-by-line.
// - Microtask Queue: Handles Promise resolves/rejects (processed immediately after current stack).
// - Macrotask Queue: Handles timers (setTimeout), I/O events, and network operations.
export async function explainEventLoopSequence() {
  const logSequence = [];

  logSequence.push('1: Synchronous start');

  setTimeout(() => {
    logSequence.push('4: Macrotask (setTimeout callback)');
  }, 0);

  Promise.resolve().then(() => {
    logSequence.push('3: Microtask (Promise resolution)');
  });

  logSequence.push('2: Synchronous end');

  return logSequence;
}
