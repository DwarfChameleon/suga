import { ValidatorFn,AbstractControl, Validators, } from "@angular/forms";
export function phoneNumberValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;
      const isValid = /^\d{11}$/.test(value); // Check if it's 11 digits
  
      return isValid ? null : { 'phoneNumber': { value } };
    };
  }