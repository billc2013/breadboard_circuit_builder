from machine import Pin
from time import sleep_ms


led = Pin(13,Pin.OUT) # led-red-5mm:anode



while True:
    led.value(1)
    sleep_ms(500)
    led.value(0)
    sleep_ms(500)



