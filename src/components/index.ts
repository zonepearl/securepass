/**
 * Component Registry
 * Import and register all custom Web Components
 */

// Shared components
import './shared/ThemeToggle.js';
import './shared/StatusIndicator.js';
import './shared/SetupWizard.js';
import './shared/BiometricAuth.js';
import './shared/DuressMode.js';
import './shared/ToastNotification.js';

// Vault components
import './vault/VaultTable.js';
import './vault/VaultSidebar.js';
import './vault/VaultToolbar.js';
import './vault/EntryModal.js';
import './vault/SecurityDashboard.js';

// Export for convenience
export { ThemeToggle } from './shared/ThemeToggle.js';
export { StatusIndicator } from './shared/StatusIndicator.js';
export { SetupWizard } from './shared/SetupWizard.js';
export { BiometricAuth } from './shared/BiometricAuth.js';
export { VaultTable } from './vault/VaultTable.js';
export { VaultSidebar } from './vault/VaultSidebar.js';
export { VaultToolbar } from './vault/VaultToolbar.js';
export { EntryModal } from './vault/EntryModal.js';
export { SecurityDashboard } from './vault/SecurityDashboard.js';
export { DuressMode } from './shared/DuressMode.js';
export * from './shared/ToastNotification.js';

