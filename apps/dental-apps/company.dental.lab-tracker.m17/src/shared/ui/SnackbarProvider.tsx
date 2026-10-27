import { useClinicSnackbar } from '@/shared/ui/ClinicSnackbar';

export function useSnackbar() {
  const snackbar = useClinicSnackbar();
  return { showToast: snackbar.showSuccess, showError: snackbar.showError };
}
