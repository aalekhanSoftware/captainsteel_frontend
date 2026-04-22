import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PowderCoatingProcessComponent } from './powder-coating-process.component';

describe('PowderCoatingProcessComponent', () => {
  let component: PowderCoatingProcessComponent;
  let fixture: ComponentFixture<PowderCoatingProcessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PowderCoatingProcessComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PowderCoatingProcessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
