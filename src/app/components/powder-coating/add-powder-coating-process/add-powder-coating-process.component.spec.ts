import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPowderCoatingProcessComponent } from './add-powder-coating-process.component';

describe('AddPowderCoatingProcessComponent', () => {
  let component: AddPowderCoatingProcessComponent;
  let fixture: ComponentFixture<AddPowderCoatingProcessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddPowderCoatingProcessComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AddPowderCoatingProcessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
