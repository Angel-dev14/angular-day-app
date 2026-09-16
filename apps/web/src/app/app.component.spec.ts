import { TestBed } from '@angular/core/testing';
import { App } from './app.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Good morning, Angel');
  });

  it('should show Friday, 18 September as the demo date', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const date = (fixture.nativeElement as HTMLElement).querySelector('.date')?.textContent;

    expect(date).toContain('18');
    expect(date).toContain('September');
    expect(date).toContain('Friday');
  });
});
