
let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

export const loadGoogleMaps = (apiKey: string): Promise<void> => {
    if (isLoaded) return Promise.resolve();
    if (isLoading) return loadPromise!;

    isLoading = true;
    loadPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return;

        // Check if already exists
        if (window.google && window.google.maps) {
            isLoaded = true;
            isLoading = false;
            return resolve();
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            isLoaded = true;
            isLoading = false;
            resolve();
        };

        script.onerror = (err) => {
            isLoading = false;
            reject(err);
        };

        document.head.appendChild(script);
    });

    return loadPromise;
};
