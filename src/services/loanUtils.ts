import { Loan } from '../domain/models';

export interface AmortizationRow {
  paymentNumber: number;
  date: string;
  amountDue: number;
  principalPart: number;
  interestPart: number;
  remainingBalance: number;
  amountPaid: number;
}

export const generateAmortizationSchedule = (loan: Loan): AmortizationRow[] => {
  const schedule: AmortizationRow[] = [];
  const principal = loan.amount;
  // Use user-provided monthly interest or calculate from annual rate
  // For simplicity, let's assume 'interest' is annual rate in %.
  const annualInterestRate = loan.interest || 0;
  const monthlyInterestRate = annualInterestRate / 12 / 100;
  const duration = loan.durationMonths || 12;
  
  // Calculate PMT if not provided
  let monthlyPayment = loan.monthlyPayment || 0;
  if (!monthlyPayment) {
    if (monthlyInterestRate > 0) {
      monthlyPayment = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, duration)) / (Math.pow(1 + monthlyInterestRate, duration) - 1);
    } else {
      monthlyPayment = principal / duration;
    }
  }

  let balance = principal;
  let currentDate = new Date(loan.startDate);
  const paymentHistory = loan.paymentHistory || [];

  for (let i = 1; i <= duration; i++) {
    const interestPart = balance * monthlyInterestRate;
    const principalPart = monthlyPayment - interestPart;
    
    // Move to next month
    currentDate = new Date(currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    const dateStr = currentDate.toISOString();

    // Check if a payment was made around this date in history
    // Simple heuristic: sum payments within 30 days of this scheduled date or just by index
    // Actually, usually users record payments sequentially. 
    // Let's assume the i-th payment in history corresponds to i-th schedule row.
    const amountPaid = paymentHistory[i - 1]?.amount || 0;

    schedule.push({
      paymentNumber: i,
      date: dateStr,
      amountDue: monthlyPayment,
      principalPart: Math.max(0, principalPart),
      interestPart: Math.max(0, interestPart),
      remainingBalance: Math.max(0, balance - principalPart),
      amountPaid
    });

    balance = Math.max(0, balance - principalPart);
    if (balance <= 0 && i >= duration) break;
  }

  return schedule;
};

export const calculateLoanTotals = (loan: Loan) => {
  const principal = loan.amount;
  const annualInterestRate = loan.interest || 0;
  const monthlyInterestRate = annualInterestRate / 12 / 100;
  const duration = loan.durationMonths || 12;
  
  let monthlyPayment = loan.monthlyPayment || 0;
  if (!monthlyPayment) {
    if (monthlyInterestRate > 0) {
      monthlyPayment = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, duration)) / (Math.pow(1 + monthlyInterestRate, duration) - 1);
    } else {
      monthlyPayment = principal / duration;
    }
  }

  const totalRepayment = monthlyPayment * duration;
  const totalInterest = Math.max(0, totalRepayment - principal);

  return {
    monthlyPayment,
    totalRepayment,
    totalInterest
  };
};
