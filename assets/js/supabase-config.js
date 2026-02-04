if (typeof SUPABASE_CONFIG === 'undefined') {
    var SUPABASE_CONFIG = {
        URL: 'https://cpkrxkhoeedzhtmkhwim.supabase.co',
        ANON_KEY: 'sb_publishable_2wsagWRjg1QZnOoTarPQGQ_vPMaIC9Q'
    };
}

if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
