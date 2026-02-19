
export const auth = {
  getAdminKey() {
    return localStorage.getItem('ADMIN_API_KEY') || '';
  },
  setAdminKey(key: string) {
    localStorage.setItem('ADMIN_API_KEY', key);
  },
  clearAdminKey() {
    localStorage.removeItem('ADMIN_API_KEY');
  }
};
