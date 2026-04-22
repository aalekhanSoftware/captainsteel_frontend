import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'indianCurrency',
  standalone: true
})
export class IndianCurrencyPipe implements PipeTransform {

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0.00';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return '0.00';
    }

    // Split the number into integer and decimal parts
    const [integerPart, decimalPart = '00'] = num.toFixed(2).split('.');
    
    // Format according to Indian numbering system
    let formattedInteger = '';
    const length = integerPart.length;
    
    if (length <= 3) {
      formattedInteger = integerPart;
    } else {
      // Get last 3 digits
      const lastThree = integerPart.substring(length - 3);
      const otherDigits = integerPart.substring(0, length - 3);
      
      // Add commas every 2 digits for the remaining part
      formattedInteger = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    }
    
    return `${formattedInteger}.${decimalPart}`;
  }
}
