import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class Tooltip extends St.Label {
    static {
        GObject.registerClass({GTypeName: 'DeepSeekTooltip'}, this);
    }

    private readonly target: St.Widget;
    private readonly hoverId: number;
    private timeoutId = 0;

    constructor(target: St.Widget) {
        super({style_class: 'dash-label', visible: false});

        this.target = target;
        this.target.track_hover = true;
        this.hoverId = this.target.connect('notify::hover', () => {
            if (this.target.hover) this.open();
            else this.close();
        });

        Main.uiGroup.add_child(this);
    }

    private open(): void {
        if (this.timeoutId) return;

        this.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this.timeoutId = 0;
            this.show();

            const extents = this.target.get_transformed_extents();
            const xOffset = Math.floor((extents.get_width() - this.width) / 2);
            const x = Math.clamp(
                extents.get_x() + xOffset,
                0,
                global.stage.width - this.width,
            );
            const yOffset = this.get_theme_node().get_length('-y-offset');
            const y = extents.get_y() - this.height - yOffset;
            this.set_position(x, y);

            this.opacity = 0;
            this.save_easing_state();
            this.set_easing_duration(150);
            this.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
            this.opacity = 255;
            this.restore_easing_state();

            return GLib.SOURCE_REMOVE;
        });
    }

    private close(): void {
        if (this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = 0;
            return;
        }

        if (!this.visible) return;

        this.remove_all_transitions();
        this.hide();
    }

    override destroy(): void {
        if (this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = 0;
        }
        this.target.disconnect(this.hoverId);
        super.destroy();
    }
}
