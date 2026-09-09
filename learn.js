(function () {
  function formatDisplay(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 'Error';
    }

    const absValue = Math.abs(numericValue);
    if (absValue >= 1e15 || (absValue > 0 && absValue < 1e-10)) {
      return numericValue.toExponential(6);
    }

    let result = numericValue.toFixed(10).replace(/\.0+$|(?<=\.\d*?)0+$/g, '').replace(/\.$/, '');
    result = result.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return result;
  }

  function performCalculation(firstValue, secondValue, operator) {
    const first = Number(firstValue);
    const second = Number(secondValue);

    switch (operator) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '*':
        return first * second;
      case '/':
        if (second === 0) {
          return Number.NaN;
        }
        return first / second;
      default:
        return second;
    }
  }

  function createCalculator() {
    const state = {
      currentValue: '0',
      storedValue: null,
      operator: null,
      waitingForNewValue: false,
    };

    function setCurrentValue(value) {
      state.currentValue = String(value);
    }

    function clearCalculator() {
      state.currentValue = '0';
      state.storedValue = null;
      state.operator = null;
      state.waitingForNewValue = false;
      return state.currentValue;
    }

    function inputDigit(digit) {
      if (digit === undefined || digit === null || digit === '') {
        return state.currentValue;
      }

      if (state.waitingForNewValue) {
        state.currentValue = digit;
        state.waitingForNewValue = false;
        return state.currentValue;
      }

      state.currentValue = state.currentValue === '0' ? digit : state.currentValue + digit;
      return state.currentValue;
    }

    function inputDecimal() {
      if (state.waitingForNewValue) {
        state.currentValue = '0.';
        state.waitingForNewValue = false;
        return state.currentValue;
      }

      if (!state.currentValue.includes('.')) {
        state.currentValue += '.';
      }
      return state.currentValue;
    }

    function deleteLastDigit() {
      if (state.waitingForNewValue) {
        return state.currentValue;
      }

      if (state.currentValue.length <= 1) {
        state.currentValue = '0';
        return state.currentValue;
      }

      state.currentValue = state.currentValue.slice(0, -1);
      return state.currentValue;
    }

    function handleOperator(nextOperator) {
      const inputValue = Number(state.currentValue);

      if (state.operator && state.waitingForNewValue) {
        state.operator = nextOperator;
        return state.currentValue;
      }

      if (state.storedValue === null) {
        state.storedValue = inputValue;
      } else if (state.operator) {
        const result = performCalculation(state.storedValue, inputValue, state.operator);
        state.currentValue = String(result);
        state.storedValue = result;
      }

      state.waitingForNewValue = true;
      state.operator = nextOperator;
      return state.currentValue;
    }

    function calculate() {
      if (state.operator === null || state.storedValue === null) {
        return state.currentValue;
      }

      const result = performCalculation(state.storedValue, Number(state.currentValue), state.operator);
      state.currentValue = String(result);
      state.storedValue = null;
      state.operator = null;
      state.waitingForNewValue = true;
      return state.currentValue;
    }

    return {
      state,
      clearCalculator,
      inputDigit,
      inputDecimal,
      deleteLastDigit,
      handleOperator,
      calculate,
      getCurrentValue: () => state.currentValue,
      formatDisplay,
      setCurrentValue,
    };
  }

  function initializeCalculator() {
    const calculator = createCalculator();
    const display = document.getElementById('display');

    const render = () => {
      display.textContent = formatDisplay(calculator.getCurrentValue());
    };

    document.querySelectorAll('button').forEach((button) => {
      const { action, value } = button.dataset;

      button.addEventListener('click', () => {
        if (action === 'digit') {
          calculator.inputDigit(value);
        } else if (action === 'operator') {
          calculator.handleOperator(value);
        } else if (action === 'decimal') {
          calculator.inputDecimal();
        } else if (action === 'equals') {
          calculator.calculate();
        } else if (action === 'clear') {
          calculator.clearCalculator();
        } else if (action === 'delete') {
          calculator.deleteLastDigit();
        }

        render();
      });
    });

    document.addEventListener('keydown', (event) => {
      const key = event.key;

      if (/^[0-9]$/.test(key)) {
        calculator.inputDigit(key);
        render();
        return;
      }

      if (key === '.') {
        calculator.inputDecimal();
        render();
        return;
      }

      if (['+', '-', '*', '/'].includes(key)) {
        calculator.handleOperator(key);
        render();
        return;
      }

      if (key === 'Enter' || key === '=') {
        calculator.calculate();
        render();
        return;
      }

      if (key === 'Backspace') {
        calculator.deleteLastDigit();
        render();
        return;
      }

      if (key.toLowerCase() === 'c') {
        calculator.clearCalculator();
        render();
      }
    });

    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeCalculator);
    } else {
      initializeCalculator();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createCalculator,
      formatDisplay,
      performCalculation,
    };
  }
})();
