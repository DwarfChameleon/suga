import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appDraggable]'
})
export class DraggableDirective {
  private posX = 0;
  private posY = 0;
  private initialX = 0;
  private initialY = 0;

  constructor(private el: ElementRef) {
    this.el.nativeElement.style.position = 'absolute';
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.initialX = event.clientX - this.posX;
    this.initialY = event.clientY - this.posY;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  onMouseMove = (event: MouseEvent): void => {
    event.preventDefault();
    this.posX = event.clientX - this.initialX;
    this.posY = event.clientY - this.initialY;
    this.el.nativeElement.style.transform = `translate3d(${this.posX}px, ${this.posY}px, 0)`;
  };

  onMouseUp = (): void => {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };
}
