import * as ex from 'excalibur';
import { Resources } from '../resources';

/**
 * Main game scene
 */
export class MainScene extends ex.Scene {
  onInitialize(engine: ex.Engine): void {
    // This is where you'll add your actors, map, etc.
    // Example: Load your map here when ready
    // const map = Resources.Maps.mainMap;
    
    // Add actors, spawners, etc.
    console.log('MainScene initialized');
  }

  onActivate(): void {
    // Called when scene becomes active
    console.log('MainScene activated');
  }

  onDeactivate(): void {
    // Called when scene is deactivated
    console.log('MainScene deactivated');
  }
}
