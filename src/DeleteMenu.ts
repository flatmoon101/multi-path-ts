class DeleteMenu extends google.maps.OverlayView {
    private div_: HTMLDivElement;
    private divListener_: google.maps.MapsEventListener | null = null;

    constructor() {
        super();
        this.div_ = document.createElement('div');
        this.div_.className = 'delete-menu';
        this.div_.innerHTML = 'Delete';

        google.maps.event.addDomListener(this.div_, 'click', () => {
            this.removeVertex();
        });
    }

    onAdd() {
        const map = this.getMap() as google.maps.Map;

        this.getPanes()!.floatPane.appendChild(this.div_);

        // mousedown anywhere on the map except on the menu div will close the menu.
        this.divListener_ = google.maps.event.addDomListener(map.getDiv(), 'mousedown', (e: MouseEvent) => {
            if (e.target !== this.div_) {
                this.close();
            }
        }, true);

    }

    onRemove() {
        if (this.divListener_) {
            google.maps.event.removeListener(this.divListener_);
            this.divListener_ = null;
        }
        if (this.div_.parentNode) {
            this.div_.parentNode.removeChild(this.div_);
        }

        // clean up
        this.set('position', null);
        this.set('path', null);
        this.set('vertex', null);
    }

    close() {
        this.setMap(null);
    }

    draw() {
        const position = this.get('position') as google.maps.LatLng;
        const projection = this.getProjection();

        if (!position || !projection) {
            return;
        }

        const point = projection.fromLatLngToDivPixel(position) as Vector;
        this.div_.style.top = point.y + 'px';
        this.div_.style.left = point.x + 'px';
    }

    /**
     * Opens the menu at a vertex of a given path.
     */
    open(map: google.maps.Map, path: google.maps.MVCArray<google.maps.LatLng>, vertex: number) {
        this.set('position', path.getAt(vertex));
        this.set('path', path);
        this.set('vertex', vertex);
        this.setMap(map);
        this.draw();
    }

    /**
     * Deletes the vertex from the path.
     */
    removeVertex() {
        const path = this.get('path') as google.maps.MVCArray<google.maps.LatLng>;
        const vertex = this.get('vertex') as number;

        if (!path || vertex == undefined) {
            this.close();
            return;
        }

        path.removeAt(vertex);
        this.close();
        for(let i = 0; i < numAgents; i++) {
            queuePointsAreaUpdate(i);
        }
    }
}
