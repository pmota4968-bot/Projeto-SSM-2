
declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, options: any);
      setZoom(zoom: number): void;
      panTo(pos: { lat: number, lng: number } | LatLng): void;
      setCenter(pos: { lat: number, lng: number } | LatLng): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
    }
    class Marker {
      constructor(options: any);
      setMap(map: Map | null): void;
      setPosition(pos: { lat: number, lng: number } | LatLng): void;
      setTitle(title: string): void;
      addListener(event: string, handler: Function): void;
    }
    namespace ControlPosition {
      const RIGHT_BOTTOM: any;
    }
    const SymbolPath: {
      CIRCLE: any;
    };
    const TravelMode: {
      DRIVING: any;
    };
    class Size {
      constructor(w: number, h: number);
    }
    class Point {
      constructor(x: number, y: number);
    }
    class DirectionsService {
      route(request: any, callback: (result: any, status: any) => void): void;
    }
    class DirectionsRenderer {
      constructor(options?: any);
      setMap(map: Map | null): void;
      setDirections(directions: any): void;
    }
    const DirectionsStatus: {
        OK: any;
    };
  }
}

interface Window {
  google: any;
}
