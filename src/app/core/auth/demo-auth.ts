import { Injectable } from '@angular/core';

const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'admin@123';

@Injectable({
  providedIn: 'root',
})
export class DemoAuth {
  authenticate(username: string, password: string): boolean {
    return username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD;
  }
}
