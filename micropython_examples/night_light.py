# Test micropython rendering
# Dec 18, 2025
# Simple night light example
# set pin for LED -- digital output
# set pin for photoresistor -- ADC input
# check photo resistor in a loop
# if value > threshold (i.e. higher voltage for lower light level) turn on LED
# else turn off LED

from machine import Pin, ADC
from time import sleep_ms

LED = Pin(21,Pin.OUT) #led-red-5mm
light = ADC(Pin(26)) #photocell-ldr

while True:
    light_reading = light.analog_value_read_u16()
    if light_reading > 800:
        LED.value(1)
    else:
        LED.value(0)
    sleep_ms(200)
